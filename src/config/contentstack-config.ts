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
     * Optional per-route content-type override, keyed by the page slug/url
     * (e.g. `{ '/organization': 'company_page' }`). When a content route's
     * resolved slug matches a key, the adapter queries that content type instead
     * of `cmsPageContentType`, still matching by the same route slug. Lets
     * distinct page types (B2B company/quote pages, etc.) resolve to their own
     * per-template content types without a `sharedSlug` mapping. Routes not
     * listed fall back to `cmsPageContentType`.
     */
    contentTypeByUrl?: Record<string, string>;

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
