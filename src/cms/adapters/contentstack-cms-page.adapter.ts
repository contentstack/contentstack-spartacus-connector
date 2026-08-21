import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, combineLatest, forkJoin, of } from 'rxjs';
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
import { ContentstackRestrictionsService } from '../access/contentstack-restrictions.service';
import {
  CONTENTSTACK_CURRENT_USER,
  ContentstackCurrentUser,
} from '../access/contentstack-current-user';

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
    protected occPageAdapter: OccCmsPageAdapter,
    protected restrictions: ContentstackRestrictionsService,
    // Optional: the feature module supplies a core-only default; when no source
    // is provided (e.g. this module used standalone) gating treats everyone as
    // anonymous rather than hard-failing DI.
    @Optional()
    @Inject(CONTENTSTACK_CURRENT_USER)
    protected currentUser$: Observable<ContentstackCurrentUser | undefined> | null = null,
  ) {}

  /**
   * The active user's permission tokens, or `of(undefined)` when gating is off.
   * `undefined` means "don't filter" everywhere downstream.
   */
  protected permissions(): Observable<Set<string> | undefined> {
    if (!this.restrictions.enabled()) {
      return of(undefined);
    }
    return (this.currentUser$ ?? of(undefined)).pipe(
      map((user) => this.restrictions.getPermissions(user)),
    );
  }

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
        '[ContentstackCmsPageAdapter] contentstack.cmsPageContentType is not configured.',
      );
    }
    const { contentType, slugField, slug, isSharedSlug } = this.resolveRequest(pageContext);
    const includeRefs = cs?.includeReferences ?? [];
    // Whole-page gating applies to per-route pages; shared-slug product/category
    // layouts are gated only when explicitly opted in (one entry = all SKUs).
    const gatePage = !isSharedSlug || (cs?.accessControl?.gateSharedSlugPages ?? false);

    // Shared shell (header/footer/nav): fetched once per navigation and merged
    // into the page structure so every page renders the global slots. The shell
    // carries navigation references (nav component → flat `all_nodes` pool →
    // link leaves), so extend the page-level includes with the flat-nav paths.
    const global = cs?.globalSlots;
    const navFields = ['navigation_bar', 'footer', 'header_links'];
    const globalIncludeRefs = [
      ...includeRefs,
      // Flat (adjacency-list) nav model: a constant, shallow chain that resolves
      // the whole menu regardless of depth — the component's `all_nodes` pool
      // plus one hop to each node's link leaves. No depth cap ever applies.
      ...navFields.flatMap(navFlatIncludeRefs),
    ];

    const occFallback = cs?.occFallback ?? true;

    // Resolve content in the active site language, re-fetching on a language
    // switch. Locale is folded into the client's TransferState keys, so SSR
    // never replays another locale's content.
    return combineLatest([this.languageService.getActive(), this.permissions()]).pipe(
      switchMap(([locale, permissions]) => {
        // When gating is on, thread the user's permissions (and whether the whole
        // page should be gated) into the fetch so restricted content is filtered
        // BEFORE it is written to SSR TransferState. Off ⇒ no arg,
        // identical caching/behavior to before.
        const page$ = permissions
          ? this.client.getPageBySlug(contentType, slugField, slug, includeRefs, locale, {
              permissions,
              gateRoot: gatePage,
            })
          : this.client.getPageBySlug(contentType, slugField, slug, includeRefs, locale);
        const global$ = global
          ? this.client.getGlobalSlots(global.contentType, global.title, globalIncludeRefs, locale)
          : of(undefined);
        // Hybrid base: the SAP page for this route. A CMS failure must never
        // break navigation, so degrade to no-base on error.
        const occBase$: Observable<CmsStructureModel | undefined> = occFallback
          ? this.occPageAdapter.load(pageContext).pipe(catchError(() => of(undefined)))
          : of(undefined);

        return forkJoin([page$, global$, occBase$]).pipe(
          map(([entry, globalEntry, occBase]) => {
            // Whole-page gate: a restricted page entry is treated as not-found,
            // and the OCC base is deliberately NOT merged — otherwise
            // `occFallback` would render the OCC twin of the restricted page
            // ("restricted" must differ from "absent").
            if (
              entry &&
              permissions &&
              gatePage &&
              !this.restrictions.isEntryAccessible(entry, permissions)
            ) {
              return {} as CmsStructureModel;
            }

            const csStructure = entry ? this.normalizer.convert(entry, {}, permissions) : undefined;
            const globalStructure = globalEntry ? this.toGlobalStructure(globalEntry) : undefined;

            // Nothing from Contentstack and no OCC base → not-found (as before).
            if (!csStructure && !occBase) {
              return {} as CmsStructureModel;
            }

            // Layer precedence: OCC base < global shell < Contentstack page.
            return mergeStructures(occBase, globalStructure, csStructure);
          }),
        );
      }),
    );
  }

  /**
   * Wrap the shared global-slots entry as a `CmsStructureModel` layer (shell
   * slots + their components) for {@link mergeStructures}. Sits between the OCC
   * base and the page: an authored shell overrides OCC's, and unauthored shell
   * slots fall through to OCC.
   */
  protected toGlobalStructure(globalEntry: ContentstackCmsPageEntry): CmsStructureModel {
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
   *  - **Content pages** resolve per-route: `slugField == pageContext.id`
   *    (optionally rewritten by `slugTransform` — see {@link resolveSlug}).
   */
  protected resolveRequest(pageContext: PageContext): {
    contentType: string;
    slugField: string;
    slug: string;
    isSharedSlug: boolean;
  } {
    const cs = this.config.contentstack;
    const defaultContentType = cs?.cmsPageContentType as string;
    const defaultSlugField = cs?.slugField ?? 'url';

    const mapping = pageContext.type ? cs?.pageTypeMapping?.[pageContext.type] : undefined;
    if (mapping?.sharedSlug) {
      return {
        contentType: mapping.contentTypeUid ?? defaultContentType,
        slugField: mapping.slugField ?? defaultSlugField,
        slug: mapping.sharedSlug,
        isSharedSlug: true,
      };
    }

    return {
      contentType: defaultContentType,
      slugField: defaultSlugField,
      slug: this.resolveSlug(pageContext),
      isSharedSlug: false,
    };
  }

  /**
   * The per-route slug for a content page: `/` for the homepage, else
   * `pageContext.id` — rewritten by `contentstack.slugTransform` when
   * configured (see its JSDoc for why this never applies to the shared-slug
   * path in {@link resolveRequest}).
   */
  protected resolveSlug(pageContext: PageContext): string {
    const raw = pageContext.id === HOME_PAGE_CONTEXT ? '/' : pageContext.id;
    const transform = this.config.contentstack?.slugTransform;
    return transform ? raw.replace(transform.pattern, transform.replacement) : raw;
  }
}

/**
 * Include paths for the flat (adjacency-list) navigation model. Depth is
 * irrelevant: the component holds every node in a single `all_nodes` reference
 * pool (one level), and each node's link leaves are one further hop
 * (`all_nodes.links`). So a fixed two-path include resolves a menu of ANY depth —
 * no per-level enumeration and no depth-cap risk. The `.links` path is a
 * constant 3 dot-segments (`<field>.all_nodes.links`), comfortably under the
 * lowest plan ceiling (Contentstack rejects a query with `error_code: 141` once
 * any include path exceeds a plan-gated dot-segment cap).
 */
export function navFlatIncludeRefs(field: string): string[] {
  return [`${field}.all_nodes`, `${field}.all_nodes.links`];
}
