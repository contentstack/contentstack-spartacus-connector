/*
 * Type definitions for the raw Contentstack Delivery API payloads this library
 * consumes. These describe *Contentstack's* JSON shape (uid, top-level fields,
 * modular_blocks, references) — the normalizers translate them into Spartacus's
 * `CmsStructureModel` / `CmsComponent`. Keeping them explicit (no `any` on the
 * hot path) is a deliberate typing requirement for this framework code.
 */

/** System metadata Contentstack attaches to every entry. */
export interface ContentstackSystemFields {
  uid: string;
  /** Content type uid — set when `include_content_type` / references are used. */
  _content_type_uid?: string;
  locale?: string;
  created_at?: string;
  updated_at?: string;
  publish_details?: {
    environment?: string;
    locale?: string;
    time?: string;
  };
  /** Present on Live Preview responses. */
  _version?: number;
}

/** A generic Contentstack entry: system fields plus arbitrary content fields. */
export interface ContentstackEntry extends ContentstackSystemFields {
  title?: string;
  [field: string]: unknown;
}

/**
 * A reference field value on a `cms_page` entry. Before `includeReference`
 * expands it, Contentstack delivers an unresolved pointer (`uid` +
 * `_content_type_uid` only); after expansion it is a fully-resolved
 * {@link ContentstackEntry} carrying the component's own content fields. The
 * page normalizer handles both, but the primary render path resolves
 * references inline (see `ContentstackClientService.getPageBySlug` +
 * `includeReferences` config).
 */
export type ContentstackReference = ContentstackEntry | { uid: string; _content_type_uid?: string };

/**
 * The CMS page entry the page adapter fetches, matching the Content Model
 * Starter Pack shipped `cms_page` schema: page-level scalar fields plus
 * **named per-slot reference fields** (`section1`, `section2_a`, `body_content`,
 * …, mapped to SAP slot names in `slot-maps.ts`), each a multi-reference to
 * component content-type entries. `header`/`footer` are single references to
 * the `cms_header`/`cms_footer` types.
 *
 * (This replaces the earlier single-`modular_blocks`-field model — the shipped
 * schema uses named slot reference fields instead.)
 */
export interface ContentstackCmsPageEntry extends ContentstackEntry {
  /** URL slug the page resolves by (field uid configurable via `slugField`, default `url`). */
  url?: string;
  /** SAP page type discriminator: `ContentPage` | `ProductPage` | `CategoryPage` | `CatalogPage`. */
  type?: string;
  /** Spartacus page template name (e.g. `LandingPage2Template`). */
  template?: string;
  /** Single reference to a `cms_header` entry. */
  header?: ContentstackReference | ContentstackReference[];
  /** Single reference to a `cms_footer` entry. */
  footer?: ContentstackReference | ContentstackReference[];
  /**
   * Named slot reference fields carry arrays of component entries. Any field
   * not enumerated above whose value is an array of resolved entries is
   * treated as a slot (name via `slot-maps.ts`).
   */
  [field: string]: unknown;
}

/**
 * A Contentstack "file" field value — assets are delivered as an inline object
 * on the entry, not a separately-linked entry (unlike `media_container`, which
 * IS a separate referenced entry of content type `media_container`).
 */
export interface ContentstackFile {
  url: string;
  filename: string;
  content_type: string;
  title?: string;
}
