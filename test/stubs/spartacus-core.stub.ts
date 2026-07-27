/*
 * Runtime stub for `@spartacus/core`, used ONLY by the offline Jest unit config.
 * The normalizer specs need just the `PageType` enum value at runtime; all other
 * imports (CmsStructureModel, Page, CmsComponent, Converter, …) are types and are
 * erased during transpilation, so they need no runtime presence here.
 */
export enum PageType {
  CONTENT_PAGE = 'ContentPage',
  PRODUCT_PAGE = 'ProductPage',
  CATEGORY_PAGE = 'CategoryPage',
  CATALOG_PAGE = 'CatalogPage',
}

// Used at runtime by the page normalizer (robots → PageRobotsMeta[]).
export enum PageRobotsMeta {
  INDEX = 'INDEX',
  NOINDEX = 'NOINDEX',
  FOLLOW = 'FOLLOW',
  NOFOLLOW = 'NOFOLLOW',
}
