import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  CmsPageAdapter,
  CmsStructureModel,
  HOME_PAGE_CONTEXT,
  LanguageService,
  OccCmsPageAdapter,
  PageContext,
  SMART_EDIT_CONTEXT,
} from '@spartacus/core';
import { ContentstackConfig } from '../../config/contentstack-config';
import { ContentstackClientService } from '../../client/contentstack-client.service';
import { ContentstackCmsPageNormalizer } from '../converters/contentstack-cms-page.normalizer';
import { ContentstackCmsPageEntry } from '../model/contentstack.model';
import { mergeStructures } from '../model/merge-structures';

/**
 * Replaces Spartacus's OCC page loader (`OccCmsPageAdapter`, which calls SAP's
 * `/occ/v2/{site}/cms/pages`). On navigation, Spartacus resolves a
 * `PageContext` and calls `load()`; we translate that into a Contentstack
 * Delivery API query by URL slug, then run the result through our
 * {@link ContentstackCmsPageNormalizer} so upstream code receives a native
 * `CmsStructureModel`.
 *
 * We invoke the normalizer directly rather than via the shared multi
 * `CMS_PAGE_NORMALIZER` token: that token already carries `OccCmsPageNormalizer`
 * (registered by `CmsOccModule`), and the converter pipeline would run it too —
 * corrupting our Contentstack payload with an OCC-shaped transform. Direct
 * invocation keeps the two sources cleanly isolated.
 *
 * Provided over the OCC binding in {@link ContentstackCmsModule} — everything
 * above the adapter (CmsPageConnector, the CMS NgRx store, the rendering engine)
 * depends only on the abstract `CmsPageAdapter`, so nothing else changes.
 *
 * **Hybrid rendering** (default, `occFallback: true`): SAP's `OccCmsPageAdapter`
 * is loaded as the **base** for every route, and Contentstack overrides only the
 * slots it authors (page slots > global_slots shell > OCC base, per
 * {@link mergeStructures}). A route with no Contentstack entry falls back
 * entirely to OCC — so the shell, navigation, and functional pages
 * (login/cart/checkout/order) render from SAP and the storefront runs
 * end-to-end. `occFallback: false` restores full-replacement mode (Contentstack
 * as the sole CMS; a route absent from Contentstack renders as not-found).
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsPageAdapter implements CmsPageAdapter {
  constructor(
    protected client: ContentstackClientService,
    protected normalizer: ContentstackCmsPageNormalizer,
    protected config: ContentstackConfig,
    protected languageService: LanguageService,
    protected occPageAdapter: OccCmsPageAdapter
  ) {}

  load(pageContext: PageContext): Observable<CmsStructureModel> {
    // SmartEdit preview context is not served by Contentstack — short-circuit so
    // the storefront never blocks waiting on the SAP CMS preview engine.
    if (pageContext.id === SMART_EDIT_CONTEXT) {
      return of({});
    }

    const cs = this.config.contentstack;
    const defaultContentType = cs?.cmsPageContentType;
    if (!defaultContentType) {
      throw new Error(
        '[ContentstackCmsPageAdapter] contentstack.cmsPageContentType is not configured.'
      );
    }
    const { contentType, slugField, slug } = this.resolveRequest(pageContext);
    const includeRefs = cs?.includeReferences ?? [];

    // Shared shell (header/footer/nav): fetched once per navigation and merged
    // into the page structure so every page renders the global slots. The shell
    // carries deep navigation references (nav component → nav_node tree → link
    // leaves), so extend the page-level includes with those nested paths — a
    // one-level include would leave the nav tree unresolved.
    const global = cs?.globalSlots;
    const globalIncludeRefs = [
      ...includeRefs,
      'navigation_bar.navigation_node',
      'navigation_bar.navigation_node.children',
      'navigation_bar.navigation_node.children.entries',
      'navigation_bar.navigation_node.entries',
      'footer.navigation_node',
      'footer.navigation_node.children',
      'footer.navigation_node.children.entries',
      'footer.navigation_node.entries',
    ];

    const occFallback = cs?.occFallback ?? true;

    // Resolve content in the active site language, re-fetching on a language
    // switch. Locale is folded into the client's TransferState keys, so SSR
    // never replays another locale's content.
    return this.languageService.getActive().pipe(
      switchMap((locale) => {
        const page$ = this.client.getPageBySlug(
          contentType,
          slugField,
          slug,
          includeRefs,
          locale
        );
        const global$ = global
          ? this.client.getGlobalSlots(
              global.contentType,
              global.title,
              globalIncludeRefs,
              locale
            )
          : of(undefined);
        // Hybrid base: the SAP page for this route. A CMS failure must never
        // break navigation, so degrade to no-base on error.
        const occBase$: Observable<CmsStructureModel | undefined> = occFallback
          ? this.occPageAdapter
              .load(pageContext)
              .pipe(catchError(() => of(undefined)))
          : of(undefined);

        return forkJoin([page$, global$, occBase$]).pipe(
          map(([entry, globalEntry, occBase]) => {
            const csStructure = entry ? this.normalizer.convert(entry) : undefined;
            const globalStructure = globalEntry
              ? this.toGlobalStructure(globalEntry)
              : undefined;

            // Nothing from Contentstack and no OCC base → not-found (as before).
            if (!csStructure && !occBase) {
              return {} as CmsStructureModel;
            }

            // Layer precedence: OCC base < global shell < Contentstack page.
            return mergeStructures(occBase, globalStructure, csStructure);
          })
        );
      })
    );
  }

  /**
   * Wrap the shared global-slots entry as a `CmsStructureModel` layer (shell
   * slots + their components) for {@link mergeStructures}. Sits between the OCC
   * base and the page: an authored shell overrides OCC's, and unauthored shell
   * slots fall through to OCC.
   */
  protected toGlobalStructure(
    globalEntry: ContentstackCmsPageEntry
  ): CmsStructureModel {
    const { slots, components } = this.normalizer.buildStructure(globalEntry);
    return { page: { slots }, components };
  }

  /**
   * Resolve which Contentstack entry to fetch for a `PageContext`:
   *
   *  - **Product / category pages** (and any type with a `sharedSlug` in
   *    `pageTypeMapping`) resolve to a **single shared layout** matched on the
   *    mapping's `slugField == sharedSlug`, ignoring the route code. One
   *    `ProductDetailsPageTemplate` / `ProductListPageTemplate` entry serves
   *    every SKU / category; the product/facet data hydrates from OCC.
   *  - **Homepage** resolves to slug `/`.
   *  - **Content pages** resolve per-route: `slugField == pageContext.id`.
   */
  protected resolveRequest(pageContext: PageContext): {
    contentType: string;
    slugField: string;
    slug: string;
  } {
    const cs = this.config.contentstack;
    const defaultContentType = cs?.cmsPageContentType as string;
    const defaultSlugField = cs?.slugField ?? 'url';

    const mapping = pageContext.type
      ? cs?.pageTypeMapping?.[pageContext.type]
      : undefined;
    if (mapping?.sharedSlug) {
      return {
        contentType: mapping.contentTypeUid ?? defaultContentType,
        slugField: mapping.slugField ?? defaultSlugField,
        slug: mapping.sharedSlug,
      };
    }

    return {
      contentType: defaultContentType,
      slugField: defaultSlugField,
      slug: pageContext.id === HOME_PAGE_CONTEXT ? '/' : pageContext.id,
    };
  }
}
