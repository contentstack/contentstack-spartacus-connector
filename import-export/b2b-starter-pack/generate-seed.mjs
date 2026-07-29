/*
 * B2B (Powertools) starter pack — demo seed entries in csdx import format
 * (entries/<content_type>/<locale>/index.json + <chunk>-entries.json).
 *
 *   node import-export/b2b-starter-pack/generate-seed.mjs
 *
 * Demonstrates the hybrid + multi-language + fallback story with NO assets, in a
 * B2B (Powertools) flavor:
 *  - a home `landing_page` ("/") with a Contentstack hero paragraph (Section1)
 *    and a product carousel (Section3) of real Powertools SKUs.
 *  - a B2B `company_page` ("/organization") — the SAP Commerce "My Company"
 *    organization-management landing (Units, Users, Cost Centers, Budgets,
 *    Purchase Limits, Account Summaries). This page type + content have NO
 *    equivalent in the generic starter pack; it is what makes this the B2B pack.
 *    The functional management widgets hydrate from OCC; here we author the
 *    editorial intro + section descriptions that layer on top.
 *  - localized in en-us (master) + de-de.
 *  - ja-jp / zh-cn are intentionally NOT localized → they fall back to en-us
 *    master content at delivery (requires includeFallback: true on the storefront).
 *
 * The SKUs and the B2B org-management copy/routes below are taken from the
 * Contentful Powertools demo data (powertools-spa catalog), so this seed reflects
 * the real B2B storefront rather than invented content.
 *
 * Entry uids are stable placeholders; csdx remaps them + resolves references on import.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'entries');
const ref = (uid, ct) => ({ uid, _content_type_uid: ct });

// Real Powertools (powertools-spa) product codes, from the Contentful demo data.
const SKUS = ['3755204', '3755205', '3755211', '3755219', '3592865', '1128762'];

// The SAP Commerce B2B "My Company" org-management areas, with the real routes
// and descriptions from the Powertools demo data (en) + German translations (de).
// Each becomes a cms_paragraph_component tile in the company page's body_content.
const ORG_SECTIONS = [
  { uid: 'seed_org_units', route: '/organization/units',
    en: { h: 'Units', p: 'Units represent departments, stores, regions, or any other logical grouping that makes sense to you. Approvers are assigned to units and individual users. Units also store the shipping addresses buyers can use when making purchases.', cta: 'Manage units' },
    de: { h: 'Einheiten', p: 'Einheiten repräsentieren Abteilungen, Filialen, Regionen oder jede andere logische Gruppierung, die für Sie sinnvoll ist. Genehmiger werden Einheiten und einzelnen Benutzern zugewiesen. Einheiten speichern außerdem die Lieferadressen, die Käufer bei Bestellungen verwenden können.', cta: 'Einheiten verwalten' } },
  { uid: 'seed_org_users', route: '/organization/users',
    en: { h: 'Users', p: 'Users are the buyers, approvers, managers, and administrators of your organization. Each user is assigned a role for making or approving purchases.', cta: 'Manage users' },
    de: { h: 'Benutzer', p: 'Benutzer sind die Käufer, Genehmiger, Manager und Administratoren Ihrer Organisation. Jedem Benutzer wird eine Rolle für das Tätigen oder Genehmigen von Einkäufen zugewiesen.', cta: 'Benutzer verwalten' } },
  { uid: 'seed_org_cost_centers', route: '/organization/cost-centers',
    en: { h: 'Cost Centers', p: "All orders placed through your organization's purchase account are linked to a cost center for tracking purposes. Each unit can have multiple cost centers.", cta: 'Manage cost centers' },
    de: { h: 'Kostenstellen', p: 'Alle über das Einkaufskonto Ihrer Organisation aufgegebenen Bestellungen sind zu Nachverfolgungszwecken mit einer Kostenstelle verknüpft. Jede Einheit kann mehrere Kostenstellen haben.', cta: 'Kostenstellen verwalten' } },
  { uid: 'seed_org_budgets', route: '/organization/budgets',
    en: { h: 'Budgets', p: 'Budgets are assigned to cost centers and set overall purchase limits.', cta: 'Manage budgets' },
    de: { h: 'Budgets', p: 'Budgets werden Kostenstellen zugewiesen und legen die gesamten Einkaufslimits fest.', cta: 'Budgets verwalten' } },
  { uid: 'seed_org_purchase_limits', route: '/organization/purchase-limits',
    en: { h: 'Purchase Limits', p: 'Purchase limits help you control spending by defining how much buyers can spend per order or per week, month, quarter, or year. Purchase limits can be assigned to users and user groups.', cta: 'Manage purchase limits' },
    de: { h: 'Einkaufslimits', p: 'Einkaufslimits helfen Ihnen, Ausgaben zu kontrollieren, indem sie festlegen, wie viel Käufer pro Bestellung oder pro Woche, Monat, Quartal oder Jahr ausgeben können. Einkaufslimits können Benutzern und Benutzergruppen zugewiesen werden.', cta: 'Einkaufslimits verwalten' } },
  { uid: 'seed_org_account_summaries', route: '/organization/account-summary',
    en: { h: 'Account Summaries', p: 'Account summaries allow you to review general information about a unit, including balances and aging summary of invoices. Here, you can also browse through a list of transaction documents for a unit.', cta: 'View account summaries' },
    de: { h: 'Kontoübersichten', p: 'Kontoübersichten ermöglichen es Ihnen, allgemeine Informationen zu einer Einheit einzusehen, einschließlich Salden und Fälligkeitsübersicht von Rechnungen. Hier können Sie auch eine Liste der Transaktionsdokumente für eine Einheit durchsehen.', cta: 'Kontoübersichten anzeigen' } },
];

const orgParagraph = (loc, s) => ({
  title: `${s[loc].h} (My Company)`,
  content: `<h3>${s[loc].h}</h3><p>${s[loc].p}</p><p><a href="${s.route}">${s[loc].cta} &rarr;</a></p>`,
});

// Build the paragraph entries for both locales from ORG_SECTIONS + the intro/hero.
const paragraphs = (loc) => {
  const out = {};
  // home hero (reused by the landing page)
  out.seed_hero = loc === 'en-us'
    ? { title: 'Powertools Home Hero (Contentstack)', content: '<h2>Powertools B2B — this section is served from Contentstack</h2><p>The header, navigation, footer, and all product data on this page come live from SAP Commerce (Powertools). This hero is an editable Contentstack &quot;island&quot; layered on top.</p>' }
    : { title: 'Powertools Home Hero (Contentstack)', content: '<h2>Powertools B2B — dieser Bereich wird von Contentstack bereitgestellt</h2><p>Kopfzeile, Navigation, Fu&szlig;zeile und alle Produktdaten auf dieser Seite kommen live von SAP Commerce (Powertools). Dieser Hero ist eine bearbeitbare Contentstack-&quot;Insel&quot;.</p>' };
  // My Company intro (top of company_page.body_content)
  out.seed_org_intro = loc === 'en-us'
    ? { title: 'My Company (intro)', content: "<h2>My Company</h2><p>Manage your organization's structure, people, and spending controls. The management tools below come live from SAP Commerce; this landing page is composed in Contentstack.</p>" }
    : { title: 'My Company (intro)', content: '<h2>Mein Unternehmen</h2><p>Verwalten Sie die Struktur, die Personen und die Ausgabenkontrollen Ihrer Organisation. Die untenstehenden Verwaltungswerkzeuge kommen live von SAP Commerce; diese Landingpage wird in Contentstack zusammengestellt.</p>' };
  const loc2 = loc === 'en-us' ? 'en' : 'de';
  for (const s of ORG_SECTIONS) out[s.uid] = orgParagraph(loc2, s);
  return out;
};

// entry body per content type per locale (uid -> fields)
const data = {
  cms_paragraph_component: { 'en-us': paragraphs('en-us'), 'de-de': paragraphs('de-de') },
  product_carousel_component: {
    'en-us': { seed_carousel: { title: 'Featured Power Tools — managed in Contentstack', products: SKUS } },
    'de-de': { seed_carousel: { title: 'Ausgewählte Elektrowerkzeuge — verwaltet in Contentstack', products: SKUS } },
  },
  cms_link_component: {
    'en-us': {
      seed_link_register: { title: 'Register organization user', link_name: 'Register a new buyer', url: '/login/register', target: 'false' },
      seed_link_quotes: { title: 'My quotes', link_name: 'View my quotes', url: '/my-account/quotes', target: 'false' },
    },
    'de-de': {
      seed_link_register: { title: 'Organisationsbenutzer registrieren', link_name: 'Neuen Käufer registrieren', url: '/login/register', target: 'false' },
      seed_link_quotes: { title: 'Meine Angebote', link_name: 'Meine Angebote anzeigen', url: '/my-account/quotes', target: 'false' },
    },
  },
  landing_page: {
    'en-us': {
      seed_home: { title: 'Powertools Home', url: '/', page_type: 'ContentPage', template: 'LandingPage2Template',
        section1: [ref('seed_hero', 'cms_paragraph_component')], section3: [ref('seed_carousel', 'product_carousel_component')] },
    },
    'de-de': {
      seed_home: { title: 'Powertools Startseite', url: '/', page_type: 'ContentPage', template: 'LandingPage2Template',
        section1: [ref('seed_hero', 'cms_paragraph_component')], section3: [ref('seed_carousel', 'product_carousel_component')] },
    },
  },
  // The B2B "My Company" landing — the differentiator vs the generic pack.
  company_page: {
    'en-us': {
      seed_company: {
        title: 'My Company', url: '/organization', page_type: 'ContentPage', template: 'CompanyPageTemplate',
        body_content: [
          ref('seed_org_intro', 'cms_paragraph_component'),
          ...ORG_SECTIONS.map((s) => ref(s.uid, 'cms_paragraph_component')),
        ],
        side_content: [ref('seed_link_register', 'cms_link_component'), ref('seed_link_quotes', 'cms_link_component')],
      },
    },
    'de-de': {
      seed_company: {
        title: 'Mein Unternehmen', url: '/organization', page_type: 'ContentPage', template: 'CompanyPageTemplate',
        body_content: [
          ref('seed_org_intro', 'cms_paragraph_component'),
          ...ORG_SECTIONS.map((s) => ref(s.uid, 'cms_paragraph_component')),
        ],
        side_content: [ref('seed_link_register', 'cms_link_component'), ref('seed_link_quotes', 'cms_link_component')],
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
