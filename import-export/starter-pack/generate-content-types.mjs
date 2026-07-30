/*
 * Generates the starter-pack content types (content_types/<uid>.json) plus the
 * surrounding csdx export skeleton (global_fields, a scrubbed environment, and
 * the empty module folders csdx's import-time audit expects). This is what makes
 * a plain `csdx cm:stacks:import --data-dir . --yes` work with auditing ON.
 *
 * Source of truth for the model — edit the compact spec below, then:
 *   node import-export/starter-pack/generate-content-types.mjs
 *
 * Only EDITORIAL component types are modeled (banner, media container, carousel,
 * paragraph, tab paragraph + its container, link, flex, nav). Functional
 * components (search, mini-cart, breadcrumb, add-to-cart, refinements, …) are
 * intentionally omitted — in the hybrid model they render from SAP OCC, not
 * Contentstack. The tab container itself is likewise functional: its panels
 * hydrate from OCC by component id (see the `tab_components` field below) —
 * only the container shell + tab-label wiring live here.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'content_types');

// --- field helpers ---
const titleField = (instruction = 'Internal name (not shown on the storefront).') => ({
  display_name: 'Title', uid: 'title', data_type: 'text', mandatory: true, unique: false,
  multiple: false, non_localizable: false, field_metadata: { _default: true, instruction },
});
const text = (uid, name, { instruction = '', multiline = false, multiple = false } = {}) => ({
  display_name: name, uid, data_type: 'text', mandatory: false, unique: false, multiple,
  non_localizable: false, field_metadata: { ...(multiline ? { multiline: true } : {}), instruction },
});
const file = (uid, name, instruction = '') => ({
  display_name: name, uid, data_type: 'file', mandatory: false, multiple: false, unique: false,
  non_localizable: false, field_metadata: { instruction },
});
const ref = (uid, name, reference_to, instruction = '') => ({
  display_name: name, uid, data_type: 'reference', reference_to, mandatory: false, multiple: true,
  unique: false, non_localizable: false,
  field_metadata: { ref_multiple: true, ref_multiple_content_types: true, instruction },
});
// A single (non-multiple) reference — for fields the normalizer reads as one
// resolved entry, not an array (e.g. media_container). Contentstack still
// returns these as a plain object, not `[entry]`, so `ref_multiple` must be
// false — unlike the multi-reference `ref()` above.
const singleRef = (uid, name, reference_to, instruction = '') => ({
  display_name: name, uid, data_type: 'reference', reference_to, mandatory: false, multiple: false,
  unique: false, non_localizable: false,
  field_metadata: { ref_multiple: false, ref_multiple_content_types: false, instruction },
});
// A JSON-array-as-text field: Contentstack's Content Type API rejects a plain
// `data_type: 'json'` schema field (verified against a live stack: "cannot set
// json data type for this field" — that data type is only available via a
// marketplace/extension mechanism, not as a first-class schema field). The
// normalizer's `parseJsonArray` already handles a string value via
// `JSON.parse`, so a multiline text field authors paste JSON into is the
// correct, working shape.
const jsonText = (uid, name, instruction = '') =>
  text(uid, name, { multiline: true, instruction });
const ct = (title, uid, description, schema, subTitle = []) => ({
  title, uid, description, schema,
  options: { is_page: false, singleton: false, sub_title: subTitle, title: 'title' },
});

// Component types that may fill a content slot (editorial only).
const EDITORIAL = [
  'simple_responsive_banner_component', 'simple_banner_component', 'product_carousel_component',
  'cms_paragraph_component', 'cms_tab_paragraph_component', 'cms_link_component', 'cms_flex_component',
];
const NAV = ['category_navigation_component', 'footer_navigation_component', 'cms_link_component'];

// Page common fields (title + routing metadata).
const pageMeta = (template) => [
  titleField('Page title.'),
  text('url', 'URL', { instruction: 'Route this page resolves at. Use "/" for the homepage.' }),
  text('page_type', 'Page Type', { instruction: 'SAP page type discriminator (e.g. ContentPage / ProductPage / CategoryPage).' }),
  text('template', 'Template', { instruction: `SAP page template. Keep "${template}".` }),
];
// A slot reference field: "SAP slot <Position>. Leave empty to keep SAP's."
const slot = (uid, name, position, refs = EDITORIAL, extra = '') =>
  ref(uid, name, refs, `Maps to SAP slot ${position}. ${extra}Leave empty to keep SAP's.`);

// Optional presentation-level access-control tokens (see
// ContentstackConfig.accessControl). A multi-value text field — `data_type:
// "json"` is rejected by the Content Type API. Empty = public; only enforced
// when the storefront sets accessControl.enabled. Added to editorial component
// types + the per-route page types (landing/content), NOT to the shell/nav
// types or the shared-slug product/category pages.
const accessTags = () =>
  text('access_tags', 'Access Tags', {
    multiple: true,
    instruction:
      'Optional access-control tokens. Empty = everyone. Use "_require-login" (hide from anonymous), ' +
      '"_require-anonymous" (hide once logged in), or "_require-<roleGroupId>" (e.g. ' +
      '"_require-b2badmingroup") to gate by SAP role group. Only enforced when the storefront enables ' +
      'access control.',
  });

// Priority order (see contentstack-cms-banner-component.normalizer.ts): a
// referenced Media Container wins over the direct per-breakpoint fields, which
// win over the single Media fallback.
const bannerMedia = [
  singleRef('media_container', 'Media Container', ['media_container'],
    'Reusable per-breakpoint image set (desktop/mobile/tablet/widescreen). Takes priority over the direct Media fields below — set this OR them, not both.'),
  file('media', 'Media', 'Fallback image, used for any breakpoint without its own image below.'),
  file('media_mobile', 'Media Mobile', 'Image for the mobile breakpoint (optional).'),
  file('media_tablet', 'Media Tablet', 'Image for the tablet breakpoint (optional).'),
  file('media_desktop', 'Media Desktop', 'Image for the desktop breakpoint (optional).'),
  file('media_widescreen', 'Media Widescreen', 'Image for the widescreen breakpoint (optional).'),
];

const contentTypes = [
  // --- component types (editorial) ---
  ct('Simple Responsive Banner Component', 'simple_responsive_banner_component',
    'A responsive banner with per-breakpoint images and a click-through link. SAP typeCode SimpleResponsiveBannerComponent.',
    [titleField('Internal name for this banner.'), text('url_link', 'URL Link', { instruction: 'Click-through destination.' }), ...bannerMedia, accessTags()]),
  ct('Simple Banner Component', 'simple_banner_component',
    'A single-image banner with a click-through link. SAP typeCode SimpleBannerComponent.',
    [titleField('Internal name for this banner.'), text('url_link', 'URL Link', { instruction: 'Click-through destination.' }),
     singleRef('media_container', 'Media Container', ['media_container'], 'Reusable media set. Takes priority over Media below — set this OR it, not both.'),
     file('media', 'Media', 'Banner image.'), accessTags()]),
  ct('Product Carousel Component', 'product_carousel_component',
    'A carousel of products by SKU; live price/stock/media hydrate from SAP OCC. SAP typeCode ProductCarouselComponent.',
    [titleField('Heading shown above the carousel.'), text('products', 'Products', { multiple: true, instruction: 'SAP product codes (SKUs), one per value. Only the code is stored; OCC provides live price/stock/image.' }), accessTags()]),
  ct('CMS Paragraph Component', 'cms_paragraph_component',
    'Rich-text / HTML content block. SAP typeCode CMSParagraphComponent.',
    [titleField('Internal name for this paragraph block.'), text('content', 'Content', { multiline: true, instruction: 'The HTML/rich-text body shown in the slot.' }), accessTags()]),
  ct('CMS Tab Paragraph Component', 'cms_tab_paragraph_component',
    'Rich-text / HTML content block, rendered the same way as CMS Paragraph Component (SAP registers both to its stock paragraph renderer). SAP typeCode CMSTabParagraphComponent.',
    [titleField('Internal name for this tab content block.'), text('content', 'Content', { multiline: true, instruction: 'The HTML/rich-text body shown in the slot.' }), accessTags()]),
  ct('Media Container', 'media_container',
    'A reusable per-breakpoint image set, referenced from the Media Container field on banner components so one asset set can back multiple banners. SAP typeCode MediaContainer.',
    [titleField('Internal name for this media set.'),
     file('desktop', 'Desktop', 'Image for the desktop breakpoint (optional).'),
     file('mobile', 'Mobile', 'Image for the mobile breakpoint (optional).'),
     file('tablet', 'Tablet', 'Image for the tablet breakpoint (optional).'),
     file('widescreen', 'Widescreen', 'Image for the widescreen breakpoint (optional).')]),
  ct('CMS Tab Paragraph Container', 'cms_tab_paragraph_container',
    'A strip of tabs whose panels hydrate from SAP OCC by component id (no editorial content lives here). SAP typeCode CMSTabParagraphContainer.',
    [titleField('Internal name for this tab set.'),
     text('component_uid', 'Component Id', { instruction: 'Optional: a stable SAP component id (e.g. "TabPanelContainer") used to build the tab-label translation keys. Leave empty to use the id of this entry.' }),
     jsonText('tab_components', 'Tab Components', 'Paste a JSON array of the tab panels, in display order, each an existing SAP CMS component reference: [{"uid": "ProductDetailsTabComponent", "type_code": "ProductDetailsTabComponent"}, ...]. Each panel content hydrates from SAP OCC by that uid — it is not authored here.')]),
  ct('CMS Link Component', 'cms_link_component',
    'A single link (used standalone or as a navigation leaf). SAP typeCode CMSLinkComponent.',
    [titleField('Internal name for this link.'), text('link_name', 'Link Name', { instruction: 'Visible link text.' }), text('url', 'URL', { instruction: 'Link destination.' }), text('target', 'Target', { instruction: '"true" to open in a new tab, else "false".' }), accessTags()]),
  ct('CMS Flex Component', 'cms_flex_component',
    'A functional block selected by its flex type (e.g. ProductIntroComponent). SAP typeCode CMSFlexComponent.',
    [titleField('Internal name.'), text('flex_type', 'Flex Type', { instruction: 'The SAP flexType that selects the Angular component (e.g. ProductIntroComponent, PageTitleComponent).' }), accessTags()]),
  ct('Nav Node', 'nav_node',
    'A node in a navigation tree: a heading with children and/or link leaves.',
    [titleField('Display label for this node (e.g. "Digital Cameras").'),
     text('uid_val', 'Node Id', { instruction: 'Stable SAP node id for this navigation node.' }),
     ref('children', 'Children', ['nav_node'], 'Child navigation nodes.'),
     ref('entries', 'Entries', ['cms_link_component'], 'Link leaves under this node.')]),
  ct('Category Navigation Component', 'category_navigation_component',
    'Header/category navigation. SAP typeCode CategoryNavigationComponent.',
    [titleField('Internal name.'), text('wrap_after', 'Wrap After', { instruction: 'Optional: wrap the menu after N items.' }), ref('navigation_node', 'Navigation Node', ['nav_node'], 'Root of the navigation tree.')]),
  ct('Footer Navigation Component', 'footer_navigation_component',
    'Footer navigation. SAP typeCode FooterNavigationComponent.',
    [titleField('Internal name.'), text('wrap_after', 'Wrap After', { instruction: 'Optional: wrap the columns after N items.' }), ref('navigation_node', 'Navigation Node', ['nav_node'], 'Root of the footer navigation tree.')]),

  // --- page types (per SAP template; only relevant slot fields) ---
  ct('Landing Page', 'landing_page',
    'CMS page on SAP LandingPage2Template (home / marketing landing).',
    [...pageMeta('LandingPage2Template'),
     slot('section1', 'Section 1', 'Section1', EDITORIAL, 'Top hero band. '),
     slot('section2', 'Section 2', 'Section2'),
     slot('section2_a', 'Section 2A', 'Section2A'),
     slot('section2_b', 'Section 2B', 'Section2B'),
     slot('section2_c', 'Section 2C', 'Section2C'),
     slot('section3', 'Section 3', 'Section3', EDITORIAL, 'Often a product carousel. '),
     slot('section4', 'Section 4', 'Section4'),
     slot('section5', 'Section 5', 'Section5'),
     accessTags()], ['url']),
  ct('Content Page', 'content_page',
    'CMS page on SAP ContentPage1Template (FAQ, terms, campaign pages).',
    [...pageMeta('ContentPage1Template'),
     slot('section1', 'Section 1', 'Section1'),
     slot('section2_a', 'Section 2A', 'Section2A'),
     slot('section2_b', 'Section 2B', 'Section2B'),
     slot('section2_c', 'Section 2C', 'Section2C'),
     slot('section3', 'Section 3', 'Section3'),
     slot('body_content', 'Body Content', 'BodyContent', EDITORIAL, 'Main content column. '),
     slot('side_content', 'Side Content', 'SideContent', EDITORIAL, 'Sidebar column. '),
     accessTags()], ['url']),
  ct('Product Page', 'product_page',
    'CMS overrides for SAP ProductDetailsPageTemplate. One shared entry serves every PDP (product data hydrates from OCC).',
    [...pageMeta('ProductDetailsPageTemplate'),
     slot('summary', 'Summary', 'Summary'),
     slot('up_selling', 'Up Selling', 'UpSelling'),
     slot('cross_selling', 'Cross Selling', 'CrossSelling'),
     slot('tabs', 'Tabs', 'Tabs', [...EDITORIAL, 'cms_tab_paragraph_container'], 'Accepts a Tab Container for a tabbed panel, or any editorial component for a plain block. '),
     slot('placeholder_content_slot', 'Placeholder Content', 'PlaceholderContentSlot')], ['url']),
  ct('Category Page', 'category_page',
    'CMS overrides for SAP ProductListPageTemplate (category/search). One shared entry serves every PLP (facets/products hydrate from OCC).',
    [...pageMeta('ProductListPageTemplate'),
     slot('product_left_refinements', 'Left Refinements', 'ProductLeftRefinements'),
     slot('product_grid_slot', 'Product Grid', 'ProductGridSlot'),
     slot('product_list_slot', 'Product List', 'ProductListSlot'),
     slot('search_results_grid_slot', 'Search Results Grid', 'SearchResultsGridSlot')], ['url']),
  ct('Global Slots', 'global_slots',
    'Shared shell (header/footer/nav) merged into every page. Author this ONLY to take over the shell in Contentstack; otherwise SAP serves it.',
    [titleField('Name of this shell entry (e.g. "Global Slots").'),
     slot('site_logo', 'Site Logo', 'SiteLogo', EDITORIAL),
     slot('search_box', 'Search Box', 'SearchBox', EDITORIAL),
     slot('mini_cart', 'Mini Cart', 'MiniCart', EDITORIAL),
     slot('navigation_bar', 'Navigation Bar', 'NavigationBar', NAV),
     slot('site_context', 'Site Context', 'SiteContext', EDITORIAL),
     slot('site_links', 'Site Links', 'SiteLinks', NAV),
     slot('header_links', 'Header Links', 'HeaderLinks', NAV),
     slot('footer', 'Footer', 'Footer', NAV)]),
];

mkdirSync(OUT, { recursive: true });
for (const t of contentTypes) {
  writeFileSync(join(OUT, `${t.uid}.json`), JSON.stringify(t, null, 2) + '\n');
}
console.log(`wrote ${contentTypes.length} content types to ${OUT}`);
console.log(contentTypes.map((t) => '  ' + t.uid).join('\n'));

// --- csdx export skeleton --------------------------------------------------
// csdx imports a *complete* export data-dir: alongside content_types/entries/
// locales it expects the other module folders to exist (its import-time audit
// loads prerequisite data from each) and a global_fields file. We scaffold the
// canonical, empty, secret-free skeleton so import works with auditing ON — no
// `--skip-audit`, no per-module runs. (A real export ships all of these.)
const ROOT = dirname(OUT);
const writeJson = (rel, data) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data));
};
// No global fields in this pack, but the file must exist (the audit reads it).
writeJson('global_fields/globalfields.json', []);
// A ready-to-use `development` environment, auto-created on import. Deliberately
// carries NO secrets (no source api_key / user uids / timestamps) — unlike a raw
// export. Publish entries here, then mint a delivery token for this environment.
writeJson('environments/environments.json', {
  blt00000000000000e1: {
    name: 'development',
    uid: 'blt00000000000000e1',
    urls: [{ url: 'http://localhost:4200', locale: 'en-us' }],
  },
});
// Empty module folders csdx's audit expects to exist (git-tracked via .gitkeep).
for (const d of ['composable_studio', 'custom-roles', 'extensions', 'labels', 'marketplace_apps', 'taxonomies', 'webhooks', 'workflows']) {
  mkdirSync(join(ROOT, d), { recursive: true });
  writeFileSync(join(ROOT, d, '.gitkeep'), '');
}
console.log('scaffolded export skeleton (global_fields, environments, empty module folders)');
