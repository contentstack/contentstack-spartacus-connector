/*
 * Generates the demo seed entries in csdx import format
 * (entries/<content_type>/<locale>/index.json + <chunk>-entries.json).
 *
 *   node import-export/starter-pack/generate-seed.mjs
 *
 * Demonstrates the hybrid + multi-language + fallback story with NO assets:
 *  - a home `landing_page` ("/") with a Contentstack hero paragraph (Section1)
 *    and a product carousel (Section3) — everything else on the page (shell,
 *    nav, footer, product data) comes from SAP OCC.
 *  - localized in en-us (master) + de-de.
 *  - ja-jp / zh-cn are intentionally NOT localized → they fall back to en-us
 *    master content at delivery (requires includeFallback: true on the storefront).
 *
 * Entry uids are stable placeholders; csdx remaps them + resolves references on import.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'entries');
const ref = (uid, ct) => ({ uid, _content_type_uid: ct });

const SKUS = ['300938', '358639', '553637', '816802', '1934793'];

// entry body per content type per locale (uid -> fields)
const data = {
  cms_paragraph_component: {
    'en-us': {
      seed_hero: {
        title: 'Home Hero (Contentstack)',
        content:
          '<h2>This section is served from Contentstack</h2><p>The header, navigation, footer, and all product data on this page come live from SAP Commerce. This hero is an editable Contentstack &quot;island&quot; layered on top.</p>',
      },
    },
    'de-de': {
      seed_hero: {
        title: 'Home Hero (Contentstack)',
        content:
          '<h2>Dieser Bereich wird von Contentstack bereitgestellt</h2><p>Kopfzeile, Navigation, Fu&szlig;zeile und alle Produktdaten auf dieser Seite kommen live von SAP Commerce. Dieser Hero ist eine bearbeitbare Contentstack-&quot;Insel&quot;.</p>',
      },
    },
  },
  product_carousel_component: {
    'en-us': { seed_carousel: { title: 'Bestsellers — managed in Contentstack', products: SKUS } },
    'de-de': { seed_carousel: { title: 'Bestseller — verwaltet in Contentstack', products: SKUS } },
  },
  landing_page: {
    'en-us': {
      seed_home: {
        title: 'Home',
        url: '/',
        page_type: 'ContentPage',
        template: 'LandingPage2Template',
        section1: [ref('seed_hero', 'cms_paragraph_component')],
        section3: [ref('seed_carousel', 'product_carousel_component')],
      },
    },
    'de-de': {
      seed_home: {
        title: 'Startseite',
        url: '/',
        page_type: 'ContentPage',
        template: 'LandingPage2Template',
        section1: [ref('seed_hero', 'cms_paragraph_component')],
        section3: [ref('seed_carousel', 'product_carousel_component')],
      },
    },
  },
};

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
