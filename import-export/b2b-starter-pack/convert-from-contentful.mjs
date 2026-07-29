/*
 * M2 full-parity converter: Contentful Powertools demo → Contentstack csdx pack.
 *
 * Reads the Contentful single-file export (contentTypes + entries + assets +
 * locales) and emits the b2b-starter-pack in Contentstack CLI (csdx) format:
 * per-template page types + editorial component types, all entries (en-us +
 * de-de), and the csdx export skeleton. Assets are handled in a later phase.
 *
 *   node import-export/b2b-starter-pack/convert-from-contentful.mjs
 *
 * Decisions (M2):
 *  - Per-template page types (landing_page, company_page, account_page, …).
 *  - "Everything meaningful, skip plumbing": editorial content types are kept;
 *    purely-functional blocks that only hydrate from OCC (CMSFlexComponent,
 *    Breadcrumb, SearchBox, MiniCart, refinement/list/add-to-cart/variant, site
 *    context, product references) are SKIPPED and their references dropped.
 *  - Snake_case uids + slot field names come from the connector's slot-maps.ts
 *    (TYPECODE_MAP / SLOT_FIELD_TO_SAP_NAME) so imported content renders.
 *
 * Source of truth for the FULL pack — supersedes generate-content-types.mjs +
 * generate-seed.mjs (the small M1 seed).
 */
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = HERE;
const SRC = join(
  HERE,
  '../../../composable-storefront-integration-library/import-export/powertools-demo-data-import/import-data/import-data.json'
);
const data = JSON.parse(readFileSync(SRC, 'utf8'));

// ---- locale mapping (Contentful code -> Contentstack locale) --------------
const LOCALE = { en: 'en-us', de: 'de-de' };
const MASTER_CF = 'en';

// ---- content-type id -> Contentstack uid ----------------------------------
const CT_UID = {
  SimpleResponsiveBannerComponent: 'simple_responsive_banner_component',
  ProductCarouselComponent: 'product_carousel_component',
  CMSLinkComponent: 'cms_link_component',
  CMSParagraphComponent: 'cms_paragraph_component',
  NavNode: 'nav_node',
  CategoryNavigationComponent: 'category_navigation_component',
  FooterNavigationComponent: 'footer_navigation_component',
  NavigationComponent: 'navigation_component',
  MediaContainer: 'media_container',
  CMSTabParagraphContainer: 'cms_tab_paragraph_container',
  CMSTabParagraphComponent: 'cms_tab_paragraph_component',
};
// Purely-functional / plumbing types: skipped; references to them are dropped.
const SKIP_TYPES = new Set([
  'CMSFlexComponent', 'BreadcrumbComponent', 'SearchBoxComponent', 'MiniCartComponent',
  'CMSSiteContextComponent', 'SearchResultsListComponent', 'ProductRefinementComponent',
  'CMSProductListComponent', 'ProductVariantSelectorComponent', 'ProductAddToCartComponent',
  'ProductReferencesComponent',
]);
// cmsHeader/cmsFooter are folded into a single `global_slots` entry (the shell).
// cmsPage is routed to a per-template page type (below).

// ---- template -> page content-type uid ------------------------------------
const TEMPLATE_UID = {
  LandingPage2Template: 'landing_page',
  ContentPage1Template: 'content_page',
  ProductDetailsPageTemplate: 'product_page',
  ProductListPageTemplate: 'category_page',
  CompanyPageTemplate: 'company_page',
  AccountPageTemplate: 'account_page',
  LoginPageTemplate: 'login_page',
  CartPageTemplate: 'cart_page',
  MultiStepCheckoutSummaryPageTemplate: 'checkout_page',
  OrderConfirmationPageTemplate: 'order_confirmation_page',
  StoreFinderPageTemplate: 'store_finder_page',
  SearchResultsListPageTemplate: 'search_results_list_page',
  ErrorPageTemplate: 'error_page',
  QuoteDetailsPageTemplate: 'quote_details_page',
};

// ---- SAP slot position -> snake_case field uid (inverse of connector map) --
const SLOT_TO_FIELD = {
  Section1: 'section1', Section2: 'section2', Section2A: 'section2_a', Section2B: 'section2_b',
  Section2C: 'section2_c', Section3: 'section3', Section4: 'section4', Section5: 'section5',
  ProductLeftRefinements: 'product_left_refinements', ProductListSlot: 'product_list_slot',
  ProductGridSlot: 'product_grid_slot', SearchResultsListSlot: 'search_results_list_slot',
  SearchResultsGridSlot: 'search_results_grid_slot', Summary: 'summary', UpSelling: 'up_selling',
  CrossSelling: 'cross_selling', Tabs: 'tabs', PlaceholderContentSlot: 'placeholder_content_slot',
  TopContent: 'top_content', MiddleContent: 'middle_content', BottomContent: 'bottom_content',
  CenterRightContentSlot: 'center_right_content_slot', CenterRightContent: 'center_right_content',
  EmptyCartMiddleContent: 'empty_cart_middle_content', BodyContent: 'body_content',
  SideContent: 'side_content', LeftContentSlot: 'left_content_slot', RightContentSlot: 'right_content_slot',
};
// Page-shell slots (header/footer/BottomHeaderSlot) are NOT modelled on page
// types — the shell lives on `global_slots`.
const PAGE_SKIP_SLOTS = new Set(['header', 'footer', 'BottomHeaderSlot']);

// Component types that may fill a page slot (editorial only).
const EDITORIAL_REFS = [
  'simple_responsive_banner_component', 'product_carousel_component', 'cms_paragraph_component',
  'cms_link_component', 'media_container', 'cms_tab_paragraph_container', 'cms_tab_paragraph_component',
  'navigation_component', 'category_navigation_component', 'footer_navigation_component',
];

// ---- helpers to read localized Contentful field values --------------------
const val = (field, cf) => (field && typeof field === 'object' ? field[cf] : undefined);
const anyVal = (field) => (field && typeof field === 'object' ? Object.values(field)[0] : field);

// entry id -> content-type id (for resolving reference targets)
const entryCt = {};
for (const e of data.entries) entryCt[e.sys.id] = e.sys.contentType.sys.id;

export {
  data, LOCALE, MASTER_CF, CT_UID, SKIP_TYPES, TEMPLATE_UID, SLOT_TO_FIELD,
  PAGE_SKIP_SLOTS, EDITORIAL_REFS, val, anyVal, entryCt,
};

// ===========================================================================
// PHASE A — CONTENT TYPES
// ===========================================================================
const titleField = (instruction = 'Internal name.') => ({
  display_name: 'Title', uid: 'title', data_type: 'text', mandatory: true, unique: false,
  multiple: false, non_localizable: false, field_metadata: { _default: true, instruction },
});
const text = (uid, name, { instruction = '', multiline = false, multiple = false } = {}) => ({
  display_name: name, uid, data_type: 'text', mandatory: false, unique: false, multiple,
  non_localizable: false, field_metadata: { ...(multiline ? { multiline: true } : {}), instruction },
});
const num = (uid, name, instruction = '') => ({
  display_name: name, uid, data_type: 'number', mandatory: false, unique: false, multiple: false,
  non_localizable: false, field_metadata: { instruction },
});
const bool = (uid, name, instruction = '') => ({
  display_name: name, uid, data_type: 'boolean', mandatory: false, unique: false, multiple: false,
  non_localizable: false, field_metadata: { instruction, default_value: false },
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
const ct = (title, uid, description, schema) => ({
  title, uid, description, schema,
  options: { is_page: false, singleton: false, sub_title: [], title: 'title' },
});
const slot = (uid, name, sapPos) =>
  ref(uid, name, EDITORIAL_REFS, `Maps to SAP slot ${sapPos}. Leave empty to keep SAP's.`);

const pageMeta = (template) => [
  titleField('Page title.'),
  text('url', 'URL', { instruction: 'Route this page resolves at (e.g. "/" or "/organization").' }),
  text('description', 'Description', { instruction: 'SEO meta description.' }),
  text('robots', 'Robots', { instruction: 'SEO robots directive.' }),
  text('page_type', 'Page Type', { instruction: 'SAP page type discriminator.' }),
  text('template', 'Template', { instruction: `SAP page template. Keep "${template}".` }),
];

// Per-template page slot fields (SAP positions actually used by that template).
const PAGE_SLOTS = {
  landing_page: ['Section1', 'Section2', 'Section2A', 'Section2B', 'Section2C', 'Section3', 'Section4', 'Section5'],
  content_page: ['Section1', 'Section2A', 'Section2B', 'Section2C', 'Section3', 'BodyContent', 'SideContent'],
  product_page: ['Summary', 'UpSelling', 'CrossSelling', 'Tabs', 'PlaceholderContentSlot'],
  category_page: ['ProductLeftRefinements', 'ProductListSlot', 'ProductGridSlot', 'SearchResultsListSlot', 'SearchResultsGridSlot'],
  company_page: ['BodyContent', 'SideContent'],
  account_page: ['BodyContent', 'SideContent'],
  login_page: ['LeftContentSlot', 'RightContentSlot', 'BodyContent', 'SideContent'],
  cart_page: ['TopContent', 'CenterRightContentSlot', 'EmptyCartMiddleContent'],
  checkout_page: ['TopContent', 'BodyContent', 'SideContent', 'BottomContent'],
  order_confirmation_page: ['BodyContent', 'SideContent'],
  store_finder_page: ['MiddleContent', 'SideContent'],
  search_results_list_page: ['ProductLeftRefinements', 'SearchResultsListSlot'],
  error_page: ['TopContent', 'BottomContent'],
  quote_details_page: ['BodyContent', 'CenterRightContent'],
};
const PAGE_TITLE = {
  landing_page: 'Landing Page', content_page: 'Content Page', product_page: 'Product Page',
  category_page: 'Category Page', company_page: 'Company Page', account_page: 'Account Page',
  login_page: 'Login Page', cart_page: 'Cart Page', checkout_page: 'Checkout Page',
  order_confirmation_page: 'Order Confirmation Page', store_finder_page: 'Store Finder Page',
  search_results_list_page: 'Search Results Page', error_page: 'Error Page', quote_details_page: 'Quote Details Page',
};

function buildContentTypes() {
  const cts = [];

  // --- editorial component types ---
  cts.push(ct('Simple Responsive Banner Component', 'simple_responsive_banner_component',
    'Responsive banner with copy, a link and images. SAP typeCode SimpleResponsiveBannerComponent.',
    [titleField('Internal name for this banner.'),
     text('headline', 'Headline'), text('content', 'Content', { multiline: true }),
     text('url_link', 'URL Link'), bool('external', 'External'), text('style_classes', 'Style Classes'),
     file('media', 'Media', 'Single image (fallback).'),
     ref('media_container', 'Media Container', ['media_container'], 'Per-breakpoint images.')]));

  cts.push(ct('Product Carousel Component', 'product_carousel_component',
    'Carousel of products by SKU; live data hydrates from OCC. SAP typeCode ProductCarouselComponent.',
    [titleField('Heading above the carousel.'),
     text('scroll', 'Scroll'), bool('popup', 'Popup'),
     text('products', 'Products', { multiple: true, instruction: 'SAP product codes (SKUs).' })]));

  cts.push(ct('CMS Paragraph Component', 'cms_paragraph_component',
    'Rich-text / HTML block. SAP typeCode CMSParagraphComponent.',
    [titleField('Internal name.'), text('content', 'Content', { multiline: true })]));

  cts.push(ct('CMS Link Component', 'cms_link_component',
    'A single link. SAP typeCode CMSLinkComponent.',
    [titleField('Internal name.'), text('link_name', 'Link Name'), text('url', 'URL'),
     bool('external', 'External'), bool('target', 'Open in New Tab'), text('style_classes', 'Style Classes')]));

  cts.push(ct('Nav Node', 'nav_node',
    'A navigation-tree node: heading with children and/or link leaves.',
    [titleField('Display label.'), text('uid_val', 'Node Id'),
     ref('children', 'Children', ['nav_node'], 'Child nodes.'),
     ref('entries', 'Entries', ['cms_link_component'], 'Link leaves.')]));

  cts.push(ct('Category Navigation Component', 'category_navigation_component',
    'Header/category navigation. SAP typeCode CategoryNavigationComponent.',
    [titleField('Internal name.'), num('wrap_after', 'Wrap After'),
     ref('navigation_node', 'Navigation Node', ['nav_node'])]));

  cts.push(ct('Footer Navigation Component', 'footer_navigation_component',
    'Footer navigation. SAP typeCode FooterNavigationComponent.',
    [titleField('Internal name.'), text('notice', 'Notice'), num('wrap_after', 'Wrap After'),
     bool('show_language_currency', 'Show Language/Currency'),
     ref('navigation_node', 'Navigation Node', ['nav_node'])]));

  cts.push(ct('Navigation Component', 'navigation_component',
    'Account/side navigation. SAP typeCode NavigationComponent.',
    [titleField('Internal name.'), text('style_class', 'Style Class'),
     ref('navigation_node', 'Navigation Node', ['nav_node'])]));

  cts.push(ct('Media Container', 'media_container',
    'Per-breakpoint images used by a banner. SAP typeCode MediaContainer.',
    [titleField('Internal name.'), file('media_desktop', 'Desktop'), file('media_mobile', 'Mobile'),
     file('media_tablet', 'Tablet'), file('media_widescreen', 'Widescreen')]));

  cts.push(ct('CMS Tab Paragraph Component', 'cms_tab_paragraph_component',
    'A single tab of rich-text content. SAP typeCode CMSTabParagraphComponent.',
    [titleField('Tab title.'), text('content', 'Content', { multiline: true })]));

  cts.push(ct('CMS Tab Paragraph Container', 'cms_tab_paragraph_container',
    'Container grouping tab paragraphs. SAP typeCode CMSTabParagraphContainer.',
    [titleField('Internal name.'), text('components', 'Components', { instruction: 'Ordered tab component ids.' })]));

  // --- per-template page types ---
  for (const [uid, slots] of Object.entries(PAGE_SLOTS)) {
    const template = Object.keys(TEMPLATE_UID).find((t) => TEMPLATE_UID[t] === uid);
    const schema = [
      ...pageMeta(template),
      ...slots.map((sap) => slot(SLOT_TO_FIELD[sap], sap.replace(/([A-Z])/g, ' $1').trim(), sap)),
    ];
    cts.push(ct(PAGE_TITLE[uid], uid, `CMS page on SAP ${template}.`, schema));
  }

  // --- global shell (header + footer) ---
  cts.push(ct('Global Slots', 'global_slots',
    'Shared shell (header/footer/nav) merged into every page. SAP cmsHeader + cmsFooter.',
    [titleField('Name of this shell entry.'),
     slot('site_logo', 'Site Logo', 'SiteLogo'), slot('search_box', 'Search Box', 'SearchBox'),
     slot('mini_cart', 'Mini Cart', 'MiniCart'), slot('navigation_bar', 'Navigation Bar', 'NavigationBar'),
     slot('site_context', 'Site Context', 'SiteContext'), slot('site_links', 'Site Links', 'SiteLinks'),
     slot('header_links', 'Header Links', 'HeaderLinks'), slot('footer', 'Footer', 'Footer')]));

  return cts;
}

// ---- write content types + csdx skeleton ----------------------------------
const OUT_CT = join(ROOT, 'content_types');
rmSync(OUT_CT, { recursive: true, force: true });
mkdirSync(OUT_CT, { recursive: true });
const contentTypes = buildContentTypes();
for (const t of contentTypes) writeFileSync(join(OUT_CT, `${t.uid}.json`), JSON.stringify(t, null, 2) + '\n');
console.log(`wrote ${contentTypes.length} content types`);

// csdx export skeleton (same as M1).
const writeJson = (rel, d) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(d));
};
writeJson('global_fields/globalfields.json', []);
writeJson('environments/environments.json', {
  blt00000000000000e1: { name: 'development', uid: 'blt00000000000000e1', urls: [{ url: 'http://localhost:4200', locale: 'en-us' }] },
});
for (const dname of ['composable_studio', 'custom-roles', 'extensions', 'labels', 'marketplace_apps', 'taxonomies', 'webhooks', 'workflows']) {
  mkdirSync(join(ROOT, dname), { recursive: true });
  writeFileSync(join(ROOT, dname, '.gitkeep'), '');
}
console.log('scaffolded csdx skeleton');

// ===========================================================================
// PHASE B — ENTRIES
// ===========================================================================
const templateOf = (id) => {
  const e = data.entries.find((x) => x.sys.id === id);
  return e ? anyVal(e.fields.template) : undefined;
};
// Resolve the Contentstack content-type uid a reference target maps to (or null to drop).
function refUid(targetId) {
  const ctId = entryCt[targetId];
  if (!ctId || SKIP_TYPES.has(ctId)) return null;
  if (ctId === 'cmsPage') return TEMPLATE_UID[templateOf(targetId)] ?? null;
  if (ctId === 'cmsHeader' || ctId === 'cmsFooter') return 'global_slots';
  return CT_UID[ctId] ?? null;
}
const mkRef = (targetId) => {
  const u = refUid(targetId);
  return u ? { uid: targetId, _content_type_uid: u } : null;
};
const refsFrom = (arr) => (Array.isArray(arr) ? arr.map((r) => mkRef(r?.sys?.id)).filter(Boolean) : []);
const skuFrom = (s) => (typeof s === 'string' && s.includes('/products/') ? s.split('/products/')[1].split(/[/?]/)[0] : String(s).split('/').pop());

// Per-field rename (Contentful field id -> Contentstack uid). '__skip' drops it.
const RENAME = {
  linkName: 'link_name', urlLink: 'url_link', styleClasses: 'style_classes', styleClass: 'style_class',
  navigationNode: 'navigation_node', wrapAfter: 'wrap_after', showLanguageCurrency: 'show_language_currency',
  uid: 'uid_val', flexType: '__skip', context: '__skip', previewUrl: '__skip', internalName: '__skip',
  mediaContainer: 'media_container',
  // MediaContainer per-breakpoint asset fields → snake_case file fields.
  desktop: 'media_desktop', mobile: 'media_mobile', tablet: 'media_tablet', widescreen: 'media_widescreen',
};
// Contentful asset id -> master-locale filename (csdx remaps a file field only
// when its value is a plain object carrying BOTH `uid` and `filename`).
const ASSET_FILE = new Map((data.assets ?? []).map((a) => {
  const f = a.fields.file || {};
  const fm = f[MASTER_CF] ?? Object.values(f)[0];
  return [a.sys.id, fm?.fileName];
}));
// Contentful field type lookup: ctId -> fieldId -> descriptor
const CT_FIELD = {};
for (const c of data.contentTypes) {
  CT_FIELD[c.sys.id] = {};
  for (const f of c.fields) CT_FIELD[c.sys.id][f.id] = f;
}
const isAssetField = (fdef) =>
  fdef && ((fdef.type === 'Link' && fdef.linkType === 'Asset') ||
    (fdef.type === 'Array' && fdef.items?.type === 'Link' && fdef.items?.linkType === 'Asset'));

// Build the field object for one Contentful entry in one Contentful locale.
function fieldsFor(entry, cf) {
  const ctId = entry.sys.contentType.sys.id;
  const out = {};
  // Title: prefer `title`, else `name`, else `internalName`, else the entry id.
  const title = entry.fields.title?.[cf] ?? entry.fields.name?.[cf] ?? entry.fields.internalName?.[cf] ?? entry.sys.id;
  out.title = title;

  const isPage = ctId === 'cmsPage';
  for (const [fid, locmap] of Object.entries(entry.fields)) {
    if (fid === 'title' || fid === 'name') continue; // handled as title
    const v = locmap?.[cf];
    if (v === undefined) continue;
    const fdef = CT_FIELD[ctId]?.[fid];

    if (isPage) {
      if (fid === 'slug') { out.url = v === 'homepage' ? '/' : (v.startsWith('/') ? v : '/' + v); continue; }
      if (fid === 'type') { out.page_type = v; continue; }
      if (fid === 'template') { out.template = v; continue; }
      if (fid === 'description' || fid === 'robots') { out[fid] = v; continue; }
      if (PAGE_SKIP_SLOTS.has(fid)) continue;               // header/footer/BottomHeaderSlot
      const field = SLOT_TO_FIELD[fid];
      if (field) { const rs = refsFrom(v); if (rs.length) out[field] = rs; continue; }
      continue;
    }

    const rename = RENAME[fid] ?? fid;
    if (rename === '__skip') continue;
    if (isAssetField(fdef)) {                               // file field → {uid, filename} so csdx remaps to the new asset uid
      const id = v?.sys?.id;
      const fn = id && ASSET_FILE.get(id);
      if (id && fn) out[rename] = { uid: id, filename: fn };
      continue;
    }
    if (fid === 'products') { out.products = (Array.isArray(v) ? v : [v]).map(skuFrom); continue; }
    if (fdef?.type === 'Link' && fdef.linkType === 'Entry') { const r = mkRef(v?.sys?.id); if (r) out[rename] = [r]; continue; }
    if (fdef?.type === 'Array' && fdef.items?.type === 'Link') { const rs = refsFrom(v); if (rs.length) out[rename] = rs; continue; }
    out[rename] = v;                                        // scalar (Symbol/Text/Integer/Boolean)
  }
  return out;
}

// Fold the single cmsHeader + cmsFooter into one global_slots entry per locale.
const HEADER_SLOT = { SiteContext: 'site_context', SiteLinks: 'site_links', SiteLogo: 'site_logo', SearchBox: 'search_box', MiniCart: 'mini_cart', NavigationBar: 'navigation_bar', HeaderLinks: 'header_links' };
function globalSlotsFields(cf) {
  const hdr = data.entries.find((e) => e.sys.contentType.sys.id === 'cmsHeader');
  const ftr = data.entries.find((e) => e.sys.contentType.sys.id === 'cmsFooter');
  const out = { title: 'Global Slots' };
  if (hdr) for (const [sap, field] of Object.entries(HEADER_SLOT)) { const rs = refsFrom(hdr.fields[sap]?.[cf]); if (rs.length) out[field] = rs; }
  if (ftr) { const rs = refsFrom(ftr.fields.Footer?.[cf]); if (rs.length) out.footer = rs; }
  return out;
}

// Group converted entries: ctUid -> locale -> { uid -> fields }
const grouped = {};
const put = (ctUid, locale, uid, fields) => {
  ((grouped[ctUid] ??= {})[locale] ??= {})[uid] = {
    uid, locale, ACL: {}, tags: [], _version: 1, _in_progress: false, publish_details: [], ...fields,
  };
};
const localesOf = (entry) => {
  const codes = new Set();
  for (const locmap of Object.values(entry.fields)) if (locmap && typeof locmap === 'object') for (const c of Object.keys(locmap)) codes.add(c);
  return codes;
};

let count = 0;
for (const entry of data.entries) {
  const ctId = entry.sys.contentType.sys.id;
  if (SKIP_TYPES.has(ctId) || ctId === 'cmsHeader' || ctId === 'cmsFooter') continue;
  let ctUid;
  if (ctId === 'cmsPage') ctUid = TEMPLATE_UID[anyVal(entry.fields.template)];
  else ctUid = CT_UID[ctId];
  if (!ctUid) continue;
  const codes = localesOf(entry);
  for (const cf of Object.keys(LOCALE)) {
    if (!codes.has(cf)) continue;                 // only create locale where content exists
    const fields = fieldsFor(entry, cf);
    put(ctUid, LOCALE[cf], entry.sys.id, fields);
    count++;
  }
}
// global_slots shell (one entry, both locales it has content for)
for (const cf of Object.keys(LOCALE)) {
  const gf = globalSlotsFields(cf);
  if (Object.keys(gf).length > 1) { put('global_slots', LOCALE[cf], 'global_slots_shell', gf); count++; }
}

// ---- write entries in csdx chunked format ---------------------------------
const OUT_E = join(ROOT, 'entries');
rmSync(OUT_E, { recursive: true, force: true });
for (const [ctUid, byLocale] of Object.entries(grouped)) {
  for (const [locale, byUid] of Object.entries(byLocale)) {
    const dir = join(OUT_E, ctUid, locale);
    mkdirSync(dir, { recursive: true });
    const chunk = `${locale}-entries.json`;
    writeFileSync(join(dir, chunk), JSON.stringify(byUid));
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ 1: chunk }));
  }
}
console.log(`wrote ${count} entry records across ${Object.keys(grouped).length} content types`);

// ===========================================================================
// PHASE C — ASSETS (csdx chunked asset module: index + chunk + files/ + meta)
// ===========================================================================
import { copyFileSync } from 'node:fs';
const CF_BASE = dirname(SRC); // .../powertools-demo-data-import/import-data
const OUT_A = join(ROOT, 'assets');
rmSync(OUT_A, { recursive: true, force: true });
mkdirSync(join(OUT_A, 'files'), { recursive: true });

// Prefer the English master file for each asset (Contentstack assets aren't localized).
const fileMeta = (a) => {
  const f = a.fields.file || {};
  return f[MASTER_CF] ?? Object.values(f)[0];
};
const localPath = (url) => join(CF_BASE, url.replace(/^\/+/, '')); // //images.ctfassets.net/... → on-disk

const assetChunk = {};
let assetOk = 0, assetMiss = 0;
for (const a of data.assets ?? []) {
  const uid = a.sys.id;
  const fm = fileMeta(a);
  if (!fm?.url || !fm?.fileName) { assetMiss++; continue; }
  const src = localPath(fm.url);
  const filename = fm.fileName;
  const destDir = join(OUT_A, 'files', uid);
  mkdirSync(destDir, { recursive: true });
  try {
    copyFileSync(src, join(destDir, filename));
  } catch {
    assetMiss++;
    continue;
  }
  assetChunk[uid] = {
    uid,
    filename,
    title: (a.fields.title?.[MASTER_CF] ?? Object.values(a.fields.title ?? {})[0] ?? filename),
    description: a.fields.description?.[MASTER_CF] ?? '',
    content_type: fm.contentType || 'application/octet-stream',
    file_size: String(fm.details?.size ?? ''),
    url: 'https:' + fm.url,
    is_dir: false,
    parent_uid: null,
    _version: 1,
    ACL: {},
    tags: [],
  };
  assetOk++;
}
// FsUtility chunked layout: assets.json = index {"1": "<chunk>"}; chunk = { uid -> asset }.
const CHUNK = 'assets-chunk-1.json';
writeFileSync(join(OUT_A, CHUNK), JSON.stringify(assetChunk));
writeFileSync(join(OUT_A, 'assets.json'), JSON.stringify({ 1: CHUNK }));
writeFileSync(join(OUT_A, 'folders.json'), JSON.stringify([]));
writeFileSync(join(OUT_A, 'metadata.json'), JSON.stringify({ 1: Object.keys(assetChunk) }));
console.log(`wrote ${assetOk} assets (${assetMiss} skipped) + binaries`);
