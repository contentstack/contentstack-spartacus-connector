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
    // carries deep navigation references (nav component → nav_node tree → link
    // leaves), so extend the page-level includes with those nested paths — a
    // one-level include would leave the nav tree unresolved.
    const global = cs?.globalSlots;
    const navTreeDepth = cs?.navTreeIncludeDepth ?? 2;
    const globalIncludeRefs = [
      ...includeRefs,
      ...navTreeIncludeRefs('navigation_bar', navTreeDepth),
      ...navTreeIncludeRefs('footer', navTreeDepth),
      ...navTreeIncludeRefs('header_links', navTreeDepth),
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
 * The Contentstack Delivery API's `includeReference` has no wildcard/deep
 * mode — every level of a nested reference chain must be spelled out as its
 * own dotted path, or that level comes back as an unresolved `{uid,
 * _content_type_uid}` stub. A nav tree's depth varies with how deeply an
 * editor nests categories (a flat "Follow Us" footer list vs. a multi-level
 * category mega-menu), so this generates paths up to `maxDepth` levels of
 * `.children` rather than hand-enumerating a fixed couple of levels — which
 * silently drops any node nested deeper than what's listed (the original bug:
 * a 3-level-deep footer tree with only 2 levels of includes came back with
 * zero resolvable leaf links).
 *
 * `maxDepth` has no universally-safe value baked in here — the caller passes
 * it (from `ContentstackConfig.navTreeIncludeDepth`, default `2`). Contentstack
 * rejects the ENTIRE query (`error_code: 141`, "include_depth should not be
 * greater than N") once any include path exceeds a dot-segment ceiling that
 * **varies by stack plan/tier** (5 is the lowest confirmed; higher tiers can
 * allow more). For a `<field>.navigation_node...` path the safe value is
 * `N - 3` (2 base segments + a trailing `.entries`, so each `.children` level
 * costs one more against the plan's cap) — see the config field's JSDoc for
 * the full formula. Passing a value too high for the actual plan breaks every
 * nav tree in the query, not just the deep one, so raise it deliberately.
 */
export function navTreeIncludeRefs(field: string, maxDepth: number): string[] {
  const root = `${field}.navigation_node`;
  const paths = [root, `${root}.entries`];
  let prefix = root;
  for (let depth = 0; depth < maxDepth; depth++) {
    prefix += '.children';
    paths.push(prefix, `${prefix}.entries`);
  }
  return paths;
}
