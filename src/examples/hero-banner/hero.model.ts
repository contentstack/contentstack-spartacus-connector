/*
 * Types for the illustrative hero-banner example component. These are NOT part
 * of the CMS override framework — they model the author-friendly `data` shape
 * the example `CustomHeroComponent` reads out of `CmsComponentData`. A real
 * consuming app would define its own component-data shapes; these live under
 * `examples/` so the core `cms/model` stays a pure description of the raw
 * Contentstack Delivery payload.
 */

/**
 * The reference shape produced by the Contentstack SAP Commerce Cloud Connector
 * Marketplace app when an editor picks a product. Only the SKU/code is stored in
 * Contentstack; live price/stock is hydrated from SAP OCC at render time.
 */
export interface SapProductRef {
  /** SAP product code / SKU. */
  code: string;
  /** Optional human label the connector may store alongside the code. */
  name?: string;
  /** Base site the product belongs to, if the connector recorded it. */
  baseSite?: string;
}

/**
 * Marketing fields + SAP product reference for the example hero component. This
 * is the typed `data` shape the hero reads out of `CmsComponentData`.
 */
export interface ContentstackHeroData {
  uid?: string;
  typeCode?: string;
  headline?: string;
  subline?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Product picked via the SAP Commerce Cloud Connector (SKU only). */
  product?: SapProductRef;
}
