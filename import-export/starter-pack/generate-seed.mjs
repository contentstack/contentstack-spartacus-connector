/*
 * Generates the demo seed entries in csdx import format
 * (entries/<content_type>/<locale>/index.json + <chunk>-entries.json).
 *
 *   node import-export/starter-pack/generate-seed.mjs
 *
 * Demonstrates the hybrid + flat-navigation + multi-language story:
 *  - a home `landing_page` ("/") with a Contentstack hero paragraph + promo banner
 *    (Section1, full-width), a product carousel (Section3), and a two-block
 *    access-gating demo (Section4). Product data, and anything not authored here,
 *    still comes live from SAP OCC.
 *  - a `global_slots` shell wiring a flat category navigation (`navigation_bar`)
 *    and a flat footer navigation (`footer`) — each a `*_flat` component whose
 *    `all_nodes` pool the connector reassembles into a tree by `parent_id`.
 *  - localized in en-us (master) + de-de.
 *  - ja-jp / zh-cn are intentionally NOT localized → they fall back to en-us
 *    master content at delivery (requires includeFallback: true on the storefront).
 *
 * The banner (`seed_banner`) shows a placeholder hero image shipped by
 * generate-assets.mjs — run that FIRST so its asset record is wired into the
 * banner's `media` field here (and imported by csdx alongside the entries).
 *
 * Entry uids are stable placeholders; csdx remaps them + resolves references on import.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = dirname(fileURLToPath(import.meta.url));
const OUT = join(PACK, 'entries');
const ref = (uid, ct) => ({ uid, _content_type_uid: ct });

// Hero image asset (from generate-assets.mjs): embed its full asset object into
// the banner's `media` file field so csdx imports + remaps it. Null (banner ships
// imageless) if generate-assets.mjs hasn't run.
const ASSET_INDEX = join(PACK, 'assets', 'index.json');
const HERO_MEDIA = existsSync(ASSET_INDEX)
  ? Object.values(JSON.parse(readFileSync(ASSET_INDEX, 'utf8')))[0]
  : null;

const LOCALES = ['en-us', 'de-de'];
/** Per-locale text: `t('English', 'Deutsch')['de-de']`. */
const t = (en, de) => ({ 'en-us': en, 'de-de': de });

const SKUS = ['300938', '358639', '553637', '816802', '1934793'];

const HERO = {
  'en-us':
    '<h2>This section is served from Contentstack</h2><p>The header, navigation, footer, and all product data on this page come live from SAP Commerce. This hero is an editable Contentstack &quot;island&quot; layered on top.</p>',
  'de-de':
    '<h2>Dieser Bereich wird von Contentstack bereitgestellt</h2><p>Kopfzeile, Navigation, Fu&szlig;zeile und alle Produktdaten auf dieser Seite kommen live von SAP Commerce. Dieser Hero ist eine bearbeitbare Contentstack-&quot;Insel&quot;.</p>',
};

// Access-gating demo (Section4). Two paragraphs tagged with access tokens: with
// the storefront's accessControl.enabled=false (default) BOTH render (tags are
// ignored → everything public); flip it to true and they swap by auth state.
// Uses the auth-state tokens (_require-login / _require-anonymous), which work on
// any SAP backend — role-group gating (_require-<roleGroupId>) needs that role to
// exist in SAP, so it's documented rather than seeded.
const GATE_MEMBER = {
  'en-us':
    '<h3>&#10003; Member exclusive</h3><p>Free shipping this week for signed-in members. This block is tagged <code>_require-login</code> — with access control enabled it shows only when you are signed in.</p>',
  'de-de':
    '<h3>&#10003; Exklusiv f&uuml;r Mitglieder</h3><p>Diese Woche kostenloser Versand f&uuml;r angemeldete Mitglieder. Dieser Block ist mit <code>_require-login</code> markiert — bei aktivierter Zugriffskontrolle nur sichtbar, wenn Sie angemeldet sind.</p>',
};
const GATE_GUEST = {
  'en-us':
    '<h3>&#128075; New here?</h3><p>Sign in to unlock member pricing. This block is tagged <code>_require-anonymous</code> — with access control enabled it hides once you sign in.</p>',
  'de-de':
    '<h3>&#128075; Neu hier?</h3><p>Melden Sie sich an, um Mitgliederpreise freizuschalten. Dieser Block ist mit <code>_require-anonymous</code> markiert — bei aktivierter Zugriffskontrolle wird er ausgeblendet, sobald Sie angemeldet sind.</p>',
};

// Link leaves (`cms_link_component`) shared by the nav trees.
const LINKS = [
  { uid: 'link_cameras', name: t('Digital Cameras', 'Digitalkameras'), url: '/Open-Catalogue/Cameras/Digital-Cameras/c/575' },
  { uid: 'link_compacts', name: t('Compact Cameras', 'Kompaktkameras'), url: '/Open-Catalogue/Cameras/Digital-Compacts/c/576' },
  { uid: 'link_headphones', name: t('Headphones', 'Kopfhörer'), url: '/Open-Catalogue/Audio/Headphones/c/577' },
  { uid: 'link_about', name: t('About Us', 'Über uns'), url: '/about' },
  { uid: 'link_careers', name: t('Careers', 'Karriere'), url: '/careers' },
  { uid: 'link_faq', name: t('FAQ', 'FAQ'), url: '/faq' },
  { uid: 'link_contact', name: t('Contact Us', 'Kontakt'), url: '/contact' },
];

// Flat nav nodes (`nav_node_flat`). `menu` groups them into the category tree
// (`cat`, header) vs the footer tree (`ft`). Heading nodes have no `link`;
// leaves carry one. Depth comes entirely from `parent` (a node_id), never from
// nested references.
const NODES = [
  // Category (header) navigation — depth 2.
  { uid: 'node_cameras', id: 'Cameras', title: t('Cameras', 'Kameras'), parent: '', sort: 1, menu: 'cat' },
  { uid: 'node_cameras_digital', id: 'CamerasDigital', title: t('Digital Cameras', 'Digitalkameras'), parent: 'Cameras', sort: 1, link: 'link_cameras', menu: 'cat' },
  { uid: 'node_cameras_compact', id: 'CamerasCompact', title: t('Compact Cameras', 'Kompaktkameras'), parent: 'Cameras', sort: 2, link: 'link_compacts', menu: 'cat' },
  { uid: 'node_audio', id: 'Audio', title: t('Audio & GPS', 'Audio & GPS'), parent: '', sort: 2, menu: 'cat' },
  { uid: 'node_audio_headphones', id: 'AudioHeadphones', title: t('Headphones', 'Kopfhörer'), parent: 'Audio', sort: 1, link: 'link_headphones', menu: 'cat' },
  // Footer navigation — depth 2.
  { uid: 'node_ft_company', id: 'FooterCompany', title: t('Company', 'Unternehmen'), parent: '', sort: 1, menu: 'ft' },
  { uid: 'node_ft_about', id: 'FooterAbout', title: t('About Us', 'Über uns'), parent: 'FooterCompany', sort: 1, link: 'link_about', menu: 'ft' },
  { uid: 'node_ft_careers', id: 'FooterCareers', title: t('Careers', 'Karriere'), parent: 'FooterCompany', sort: 2, link: 'link_careers', menu: 'ft' },
  { uid: 'node_ft_help', id: 'FooterHelp', title: t('Help', 'Hilfe'), parent: '', sort: 2, menu: 'ft' },
  { uid: 'node_ft_faq', id: 'FooterFAQ', title: t('FAQ', 'FAQ'), parent: 'FooterHelp', sort: 1, link: 'link_faq', menu: 'ft' },
  { uid: 'node_ft_contact', id: 'FooterContact', title: t('Contact Us', 'Kontakt'), parent: 'FooterHelp', sort: 2, link: 'link_contact', menu: 'ft' },
];

// entry body per content type per locale (uid -> fields)
const data = {};
const put = (ct, locale, uid, fields) => {
  (data[ct] ??= {})[locale] ??= {};
  data[ct][locale][uid] = fields;
};
const nodesFor = (menu) => NODES.filter((n) => n.menu === menu).map((n) => ref(n.uid, 'nav_node_flat'));

for (const locale of LOCALES) {
  put('cms_paragraph_component', locale, 'seed_hero', {
    title: 'Home Hero (Contentstack)',
    content: HERO[locale],
  });
  // Access-gating demo blocks (Section4). access_tags is the shipped gating field
  // (opt-in via accessControl.enabled on the storefront).
  put('cms_paragraph_component', locale, 'seed_gate_member', {
    title: 'Member Exclusive (gated)',
    content: GATE_MEMBER[locale],
    access_tags: ['_require-login'],
  });
  put('cms_paragraph_component', locale, 'seed_gate_guest', {
    title: 'Guest Prompt (gated)',
    content: GATE_GUEST[locale],
    access_tags: ['_require-anonymous'],
  });
  put('product_carousel_component', locale, 'seed_carousel', {
    title: t('Bestsellers — managed in Contentstack', 'Bestseller — verwaltet in Contentstack')[locale],
    products: SKUS,
  });
  put('simple_banner_component', locale, 'seed_banner', {
    title: t('Promo Banner (Contentstack)', 'Aktionsbanner (Contentstack)')[locale],
    url_link: '/Open-Catalogue/Cameras/c/575',
    ...(HERO_MEDIA ? { media: HERO_MEDIA } : {}),
  });

  for (const l of LINKS) {
    put('cms_link_component', locale, l.uid, {
      title: l.name[locale],
      link_name: l.name[locale],
      url: l.url,
      target: 'false',
    });
  }
  for (const n of NODES) {
    put('nav_node_flat', locale, n.uid, {
      title: n.title[locale],
      node_id: n.id,
      parent_id: n.parent,
      sort_order: n.sort,
      links: n.link ? [ref(n.link, 'cms_link_component')] : [],
    });
  }

  put('category_navigation_flat', locale, 'seed_cat_nav', {
    title: 'Main Navigation',
    all_nodes: nodesFor('cat'),
  });
  put('footer_navigation_flat', locale, 'seed_footer_nav', {
    title: 'Footer Navigation',
    all_nodes: nodesFor('ft'),
  });

  put('global_slots', locale, 'seed_global', {
    title: 'Global Slots',
    navigation_bar: [ref('seed_cat_nav', 'category_navigation_flat')],
    footer: [ref('seed_footer_nav', 'footer_navigation_flat')],
  });

  put('landing_page', locale, 'seed_home', {
    title: t('Home', 'Startseite')[locale],
    url: '/',
    page_type: 'ContentPage',
    template: 'LandingPage2Template',
    // Section1 is full-width, so both the hero paragraph and the promo banner
    // live here (banner below the text). NOTE: the SAP LandingPage2Template
    // renders Section1, Section2A/2B/2C, Section3-5 — there is NO bare "Section2"
    // slot, and Section2A/2B/2C are narrow 1/3 columns, so a full-width banner
    // belongs in Section1 (verified rendering in a live Spartacus storefront).
    section1: [
      ref('seed_hero', 'cms_paragraph_component'),
      ref('seed_banner', 'simple_banner_component'),
    ],
    section3: [ref('seed_carousel', 'product_carousel_component')],
    // Section4 (full-width): the access-gating demo. Both show until the
    // storefront sets accessControl.enabled=true, then they gate by auth state.
    section4: [
      ref('seed_gate_guest', 'cms_paragraph_component'),
      ref('seed_gate_member', 'cms_paragraph_component'),
    ],
  });
}

// csdx import (cli v1.65) reads entries per content-type + locale from a chunked
// directory: entries/<ct>/<locale>/index.json maps page -> chunk file, and each
// chunk file is a map of entry uid -> entry. (Matches FsUtility in
// @contentstack/cli-utilities; a flat <locale>.json is NOT read.) References are
// remapped by csdx on import.
rmSync(OUT, { recursive: true, force: true });
let count = 0;
for (const [ct, byLocale] of Object.entries(data)) {
  for (const [locale, byUid] of Object.entries(byLocale)) {
    const chunk = {};
    for (const [uid, fields] of Object.entries(byUid)) {
      // `publish_details: []` is required: csdx's import-time audit calls
      // `.filter()` on it unguarded and crashes if it's absent. `_version` +
      // empty draft fields match the shape of a real csdx export entry.
      chunk[uid] = { uid, locale, ACL: {}, tags: [], _version: 1, _in_progress: false, publish_details: [], ...fields };
      count++;
    }
    const localeDir = join(OUT, ct, locale);
    mkdirSync(localeDir, { recursive: true });
    const chunkFile = `${locale}-entries.json`;
    writeFileSync(join(localeDir, chunkFile), JSON.stringify(chunk));
    writeFileSync(join(localeDir, 'index.json'), JSON.stringify({ 1: chunkFile }));
  }
}
console.log(`wrote ${count} entry records across ${Object.keys(data).length} content types (en-us + de-de) to ${OUT}`);
