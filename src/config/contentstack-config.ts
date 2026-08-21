import { Region } from '@contentstack/delivery-sdk';
import { PageType } from '@spartacus/core';

/**
 * Maps a SAP Composable Storefront page type (the `PageType` Spartacus resolves
 * from routing) to the Contentstack content type that models it, plus the field
 * on that content type that carries the page's URL slug.
 */
export interface ContentstackPageTypeMapping {
  /** Contentstack content type uid that models this Spartacus page type. */
  contentTypeUid: string;
  /**
   * Field uid on the content type that holds the page URL/slug used to resolve
   * a page by route (e.g. `url`). Defaults to `ContentstackConfig.contentstack.slugField`.
   */
  slugField?: string;
  /**
   * For page types that use a **single shared layout** regardless of the route
   * code — product pages (all SKUs share `ProductDetailsPageTemplate`) and
   * category pages (all categories share `ProductListPageTemplate`) — the fixed
   * value to match on `slugField` instead of the route's code. e.g. set
   * `slugField: 'page_type'` + `sharedSlug: 'ProductPage'` and author one entry
   * with `page_type = 'ProductPage'`; every product renders it and hydrates its
   * own SKU from OCC. Omit for content pages (resolved per-slug by route).
   */
  sharedSlug?: string;
}

/**
 * Presentation-level content gating. When `enabled`, entries carrying required
 * audience/permission tokens in `accessField` are hidden from users who don't
 * hold those tokens. Tokens are derived from the current user's roles (see the
 * `CONTENTSTACK_CURRENT_USER` token). Opt-in — default off.
 *
 * NOT a security boundary: gated entries are still fetched from the Delivery API
 * (the delivery token ships in the client bundle) and dropped before render, so
 * a determined user can still read them via the API/devtools. Use it to tailor
 * what the UI shows, not to protect confidential data.
 */
export interface ContentstackAccessControl {
  /** Master switch. Default `false` — every path behaves as if gating is absent. */
  enabled?: boolean;
  /**
   * Entry field uid holding the required-token list (a multi-value text field on
   * the content type). An entry with no tokens (absent/empty) is public. Default
   * `access_tags`.
   */
  accessField?: string;
  /** Token granted to anonymous visitors. Default `_require-anonymous`. */
  anonymousToken?: string;
  /** Token granted to any logged-in user. Default `_require-login`. */
  loginToken?: string;
  /**
   * Prefix applied to each of the user's role ids to form a permission token
   * (role `b2badmingroup` → `_require-b2badmingroup`). Only entry tokens starting
   * with this prefix are enforced; others are ignored. Default `_require-`.
   */
  rolePrefix?: string;
  /**
   * Whether to apply page-level gating to shared-slug product/category layouts.
   * Default `false` — one shared entry gates every SKU/category at once, which is
   * rarely intended (real product data comes from OCC regardless).
   */
  gateSharedSlugPages?: boolean;
}

/**
 * Root configuration for the Contentstack CMS feature.
 *
 * Extends the Spartacus `Config` token so it merges into the global app config
 * and can be provided with `provideConfig(...)` / `provideDefaultConfig(...)`
 * exactly like any other Spartacus config slice.
 */
export abstract class ContentstackConfig {
  contentstack?: {
    /**
     * Delivery credentials + connection settings for the Contentstack Delivery API.
     * These feed straight into `contentstack.stack(...)`.
     */
    delivery: {
      /** Stack API key. */
      apiKey: string;
      /** Delivery token scoped to the environment below. */
      deliveryToken: string;
      /** Publishing environment name (e.g. `production`). */
      environment: string;
      /** Data-center region. Defaults to `Region.US`. */
      region?: Region;
      /** Optional branch (Contentstack branching). Defaults to `main`. */
      branch?: string;
      /**
       * When true, the delivery stack is built with Contentstack Live Preview
       * enabled (draft content via the preview host) and the Live Preview SDK
       * initializes in the storefront so Visual Builder edits update live.
       * Requires `previewToken`. Use a preview-specific build — a normal
       * production build should leave this false.
       */
      livePreview?: boolean;
      /**
       * Live Preview preview token (separate from the delivery token). Required
       * when `livePreview` is true — the delivery SDK uses it to fetch draft
       * content from the preview host.
       */
      previewToken?: string;
      /**
       * Live Preview host. Defaults to `rest-preview.contentstack.com` (US);
       * set the region-matching preview host for EU/Azure/GCP stacks.
       */
      previewHost?: string;
    };

    /**
     * Default field uid holding the URL slug on CMS page content types. Can be
     * overridden per page type via `ContentstackPageTypeMapping.slugField`.
     * Defaults to `url`.
     */
    slugField?: string;

    /**
     * Optional regex rewrite applied to a route's slug (`PageContext.id`) before
     * it's queried against `slugField` — for when OCC's route and the CMS
     * entry's authored slug don't match byte-for-byte (a locale/category
     * prefix OCC includes but the CMS entry omits, differing separators, …).
     * Applied via `slug.replace(pattern, replacement)`, same semantics as
     * `String.replace`. Only applies to per-route content pages; page types
     * resolved via `ContentstackPageTypeMapping.sharedSlug` use that fixed
     * config value directly and are never route-derived, so a rewrite has
     * nothing to act on there.
     *
     * Example — strip a leading locale segment OCC includes in the route but
     * the CMS entry's `url` field omits:
     * `{ pattern: /^\/en\//, replacement: '/' }` turns `/en/about-us` into
     * `/about-us` before the query runs.
     */
    slugTransform?: { pattern: RegExp; replacement: string };

    /**
     * Presentation-level role/audience content gating. Off by default; see
     * {@link ContentstackAccessControl}.
     */
    accessControl?: ContentstackAccessControl;

    /**
     * Maps a Spartacus site language isocode (what `LanguageService.getActive()`
     * emits, e.g. `en`, `de`) to the Contentstack locale code content is authored
     * in (e.g. `en-us`, `de-de`). The delivery layer resolves the active language
     * through this map before querying, so the storefront's language codes and
     * the Contentstack stack's locale codes don't have to be identical.
     *
     * Identity fallback: an isocode with no entry here is passed through
     * unchanged. Omit entirely (or leave `{}`) when the storefront isocodes
     * already match the Contentstack locale codes.
     *
     * Example: `{ en: 'en-us', de: 'de-de' }`.
     */
    localeMapping?: Record<string, string>;

    /**
     * Hybrid rendering. When true (default), the SAP OCC page is loaded as the
     * **base** for every route and Contentstack **overrides only the slots it
     * authors** — anything not in Contentstack (shell, nav, footer, and pages
     * like login/cart/checkout/order) falls back to OCC, so the storefront runs
     * end-to-end. Set false for full-replacement mode (Contentstack is the sole
     * CMS; a route absent from Contentstack renders as not-found).
     */
    occFallback?: boolean;

    /**
     * Register custom slots beyond the shipped set: Contentstack field uid → SAP
     * slot **position** name (e.g. `{ my_promo_strip: 'MyPromoStrip' }`). Merged
     * over the built-in slot map for content discovery. The slot still only
     * renders if the storefront's template/`LayoutConfig` declares that position
     * and the content type carries a matching reference field.
     */
    additionalSlotFields?: Record<string, string>;

    /**
     * When true, Delivery API queries request Contentstack's `include_fallback`
     * behavior (delivery-sdk `.includeFallback()`): an entry not localized in the
     * active non-master locale falls back to its master-locale content instead of
     * returning empty. Only applied when a locale is actually resolved (see
     * `localeMapping`); with no locale the stack already serves the master locale,
     * so fallback is a no-op. Defaults to `false` (strict per-locale content).
     */
    includeFallback?: boolean;

    /**
     * The content type uid whose entries model CMS pages (the "CMS Page" type).
     * Used by the page adapter to query a page by slug.
     */
    cmsPageContentType?: string;

    /**
     * Optional content type uid used by the component adapter for *standalone*
     * component lookups (`CmsComponentAdapter.load` / `findComponentsByIds`).
     *
     * The primary path delivers component data embedded in the page payload (the
     * page normalizer emits `components[]`, which Spartacus loads into the CMS
     * store without hitting the component adapter). This is only consulted when
     * Spartacus requests a shared/reusable component by uid that is not already
     * in the store. Leave unset if all components ship inside pages.
     */
    componentContentType?: string;

    /**
     * The Contentstack content type uid → Spartacus PageType mapping. Optional;
     * when a page type is not listed, the adapter treats it as a ContentPage.
     */
    pageTypeMapping?: Partial<Record<PageType, ContentstackPageTypeMapping>>;

    /**
     * Optional map of Contentstack block uid → Spartacus typeCode, consulted by
     * the page normalizer when a block has no explicit `type_code` field. Lets an
     * app map author-named blocks to stock component types without editing content.
     */
    componentTypeMapping?: Record<string, string>;

    /**
     * Shared/global slots (header, footer, navigation, logo, …) authored once and
     * merged into every page. When set, the page adapter fetches this entry and
     * merges its slots + components into each page's `CmsStructureModel`. Omit if
     * every page carries its own shell.
     */
    globalSlots?: {
      /** Content type uid holding the shared slots (e.g. `global_slots`). */
      contentType: string;
      /**
       * Title of the specific global-slots entry to load. Omit for the first
       * (typically singleton) entry of the content type.
       */
      title?: string;
    };

    /**
     * Reference field uids to expand when fetching a page (Contentstack
     * `includeReference`). Referenced modules are resolved in a single call so
     * the normalizer sees fully-expanded content.
     */
    includeReferences?: string[];

    /**
     * Timeout (ms) applied to Delivery API calls. Defaults to 10000. Exposed so
     * a CMS slow-down never hangs the storefront (see resilience handling in the
     * client service).
     */
    timeoutMs?: number;
  };
}

// Ambient module augmentation so `provideConfig`/`provideDefaultConfig` accept
// the Contentstack slice with full type-safety, the same way Spartacus augments
// its own `Config`.
declare module '@spartacus/core' {
  interface Config extends ContentstackConfig {}
}
