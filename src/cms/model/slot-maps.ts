/*
 * Mapping tables between Contentstack's content-model UIDs and SAP/Spartacus's
 * names, for the Content Model Starter Pack shipped schema.
 *
 * WHY THESE EXIST: Contentstack requires lowercase snake_case UIDs
 * (`^[a-z][a-z0-9_]*$`), but SAP Spartacus keys components by their PascalCase
 * typecodes (e.g. `SimpleResponsiveBannerComponent`) and slots by SAP position
 * names (e.g. `Section2A`). The content-model translator lowercased both on
 * import; these tables (generated from that translator's `docs/typecode-map.json`
 * and `docs/slot-field-map.json`) map them back so the normalizer emits the
 * real SAP typecodes/slot names Spartacus's rendering engine and
 * `CmsConfig.cmsComponents` expect.
 */

/** Contentstack content-type uid → original SAP CMS component typecode. */
export const TYPECODE_MAP: Readonly<Record<string, string>> = {
  simple_responsive_banner_component: 'SimpleResponsiveBannerComponent',
  simple_banner_component: 'SimpleBannerComponent',
  product_carousel_component: 'ProductCarouselComponent',
  cms_site_context_component: 'CMSSiteContextComponent',
  cms_flex_component: 'CMSFlexComponent',
  cms_link_component: 'CMSLinkComponent',
  search_box_component: 'SearchBoxComponent',
  mini_cart_component: 'MiniCartComponent',
  category_navigation_component: 'CategoryNavigationComponent',
  footer_navigation_component: 'FooterNavigationComponent',
  cms_paragraph_component: 'CMSParagraphComponent',
  nav_node: 'NavNode',
  breadcrumb_component: 'BreadcrumbComponent',
  cms_page: 'cmsPage',
  cms_header: 'cmsHeader',
  cms_footer: 'cmsFooter',
  media_container: 'MediaContainer',
  search_results_list_component: 'SearchResultsListComponent',
  product_refinement_component: 'ProductRefinementComponent',
  cms_product_list_component: 'CMSProductListComponent',
  navigation_component: 'NavigationComponent',
  product_references_component: 'ProductReferencesComponent',
  product_variant_selector_component: 'ProductVariantSelectorComponent',
  product_add_to_cart_component: 'ProductAddToCartComponent',
  cms_tab_paragraph_container: 'CMSTabParagraphContainer',
  cms_tab_paragraph_component: 'CMSTabParagraphComponent',
  assisted_service_component: 'AssistedServiceComponent',
  asm_customer360_component: 'AsmCustomer360Component',
  checkout_replenishment_component: 'CheckoutReplenishmentComponent',
  saved_cart_component: 'SavedCartComponent',
  organization_admin_component: 'OrganizationAdminComponent',
};

/** `cms_page` slot field uid → real SAP Spartacus slot position name. */
export const SLOT_FIELD_TO_SAP_NAME: Readonly<Record<string, string>> = {
  bottom_header_slot: 'BottomHeaderSlot',
  section1: 'Section1',
  section2: 'Section2',
  section2_a: 'Section2A',
  section2_b: 'Section2B',
  section2_c: 'Section2C',
  section3: 'Section3',
  section4: 'Section4',
  section5: 'Section5',
  product_left_refinements: 'ProductLeftRefinements',
  product_list_slot: 'ProductListSlot',
  product_grid_slot: 'ProductGridSlot',
  search_results_list_slot: 'SearchResultsListSlot',
  search_results_grid_slot: 'SearchResultsGridSlot',
  summary: 'Summary',
  up_selling: 'UpSelling',
  cross_selling: 'CrossSelling',
  tabs: 'Tabs',
  placeholder_content_slot: 'PlaceholderContentSlot',
  top_content: 'TopContent',
  middle_content: 'MiddleContent',
  bottom_content: 'BottomContent',
  center_right_content_slot: 'CenterRightContentSlot',
  center_right_content: 'CenterRightContent',
  empty_cart_middle_content: 'EmptyCartMiddleContent',
  body_content: 'BodyContent',
  side_content: 'SideContent',
  left_content_slot: 'LeftContentSlot',
  right_content_slot: 'RightContentSlot',
  // Shared shell (header/footer/nav) positions — authored on the `global_slots`
  // entry and layered into every page. Contentstack field uids are lowercase
  // snake_case; these map them back to the exact SAP slot POSITION names
  // Spartacus renders by (see contentstack-cms-page.adapter + merge-structures).
  site_logo: 'SiteLogo',
  search_box: 'SearchBox',
  mini_cart: 'MiniCart',
  navigation_bar: 'NavigationBar',
  site_context: 'SiteContext',
  site_links: 'SiteLinks',
  header_links: 'HeaderLinks',
  footer: 'Footer',
};

/** `cms_page` reference fields (slots + header/footer) to expand on fetch via `includeReference`. */
export const PAGE_REFERENCE_FIELDS: readonly string[] = [
  'header',
  'footer',
  ...Object.keys(SLOT_FIELD_TO_SAP_NAME),
];

/** Resolve a SAP typecode for a Contentstack content-type uid (identity fallback for custom types). */
export function toTypeCode(contentTypeUid: string | undefined): string {
  if (!contentTypeUid) {
    return '';
  }
  return TYPECODE_MAP[contentTypeUid] ?? contentTypeUid;
}

/** Resolve a SAP slot name for a Contentstack field uid (identity fallback for unmapped fields). */
export function toSlotName(fieldUid: string): string {
  return SLOT_FIELD_TO_SAP_NAME[fieldUid] ?? fieldUid;
}

/**
 * The slot allowlist actually used for discovery: the shipped
 * `SLOT_FIELD_TO_SAP_NAME` plus any app-registered custom slots
 * (`contentstack.additionalSlotFields`, field uid → SAP slot position). Custom
 * entries win on key collisions. A custom slot still only renders if the
 * storefront's template/`LayoutConfig` declares that SAP position.
 */
export function effectiveSlotMap(
  additionalSlotFields?: Record<string, string>
): Readonly<Record<string, string>> {
  return additionalSlotFields
    ? { ...SLOT_FIELD_TO_SAP_NAME, ...additionalSlotFields }
    : SLOT_FIELD_TO_SAP_NAME;
}

/**
 * The render subtype Spartacus uses to select the Angular component. For a
 * `CMSFlexComponent` it is the authored `flex_type` (e.g. `ProductIntroComponent`
 * / `PageTitleComponent`); for every other component it is the typeCode itself.
 * Shared by the page normalizer (slot component data) and the field mapper (the
 * component's own `flexType`) so the two can't drift.
 */
export function resolveFlexType(
  fields: Record<string, unknown>,
  typeCode: string
): string {
  if (typeCode === 'CMSFlexComponent') {
    const flex = fields['flex_type'] ?? fields['flexType'];
    if (typeof flex === 'string' && flex.length) {
      return flex;
    }
  }
  return typeCode;
}
