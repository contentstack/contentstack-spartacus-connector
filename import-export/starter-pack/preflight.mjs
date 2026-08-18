/*
 * Offline pre-flight for the starter pack — run BEFORE `csdx cm:stacks:import`
 * to catch structural problems the live import would otherwise fail on.
 *
 *   node import-export/starter-pack/preflight.mjs
 *
 * Checks: the complete csdx export skeleton is present; nav is flat-only; every
 * entry reference points at a shipped content type; the locale + fallback setup;
 * the assets module (binary present, size matches, no external CDN refs, media
 * wired, no foreign CDN url baked in); and a secret scan (real tokens/keys must never be committed — the
 * all-zero `blt0…` placeholder uids csdx remaps on import are allowed).
 *
 * Exit code is non-zero if any blocker is found (usable in CI).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACK = dirname(fileURLToPath(import.meta.url));
let fail = 0, warn = 0;
const ok = (m) => console.log('  ✅', m);
const bad = (m) => { console.log('  ❌', m); fail++; };
const wn = (m) => { console.log('  ⚠️ ', m); warn++; };
const rd = (...p) => JSON.parse(readFileSync(join(PACK, ...p), 'utf8'));

console.log('\n[1] Complete csdx export skeleton');
for (const m of ['content_types', 'entries', 'locales', 'environments', 'global_fields', 'assets',
  'composable_studio', 'custom-roles', 'extensions', 'labels', 'marketplace_apps', 'taxonomies', 'webhooks', 'workflows'])
  existsSync(join(PACK, m)) ? ok(m + '/') : bad('MISSING ' + m + '/');

console.log('\n[2] Content types (flat-only nav)');
const cts = readdirSync(join(PACK, 'content_types')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
console.log('  count:', cts.length);
const nested = cts.filter((c) => ['nav_node', 'category_navigation_component', 'footer_navigation_component'].includes(c));
nested.length ? bad('nested nav types present: ' + nested) : ok('no nested nav types');

console.log('\n[3] Entry references + publish_details');
const perLocale = {};
for (const ct of readdirSync(join(PACK, 'entries'))) {
  for (const loc of readdirSync(join(PACK, 'entries', ct))) {
    // csdx scaffolds empty <locale> folders into the data-dir on import; skip
    // any locale dir without an index.json (it holds no entries to check).
    if (!existsSync(join(PACK, 'entries', ct, loc, 'index.json'))) continue;
    perLocale[loc] = (perLocale[loc] ?? 0);
    const idx = rd('entries', ct, loc, 'index.json');
    for (const chunk of Object.values(idx)) {
      const recs = rd('entries', ct, loc, chunk);
      perLocale[loc] += Object.keys(recs).length;
      for (const e of Object.values(recs)) {
        if (!Array.isArray(e.publish_details)) bad(`${ct}/${loc}/${e.uid}: publish_details not an array`);
        for (const v of Object.values(e)) if (Array.isArray(v)) for (const it of v)
          if (it && it._content_type_uid && !cts.includes(it._content_type_uid) && it._content_type_uid !== 'sys_assets')
            bad(`${ct}/${e.uid} references unknown content type ${it._content_type_uid}`);
      }
    }
  }
}
ok('records per locale: ' + JSON.stringify(perLocale));

console.log('\n[4] Locales + fallback');
const lj = rd('locales', 'locales.json');
const codes = Object.values(lj).map((l) => l.code);
for (const c of ['de-de', 'ja-jp', 'zh-cn']) codes.includes(c) ? ok('locale ' + c) : bad('missing locale ' + c);
const noFb = Object.values(lj).filter((l) => l.fallback_locale !== 'en-us');
noFb.length ? wn('no en-us fallback: ' + noFb.map((l) => l.code)) : ok('all fall back to en-us');
existsSync(join(PACK, 'locales', 'master-locale.json')) ? ok('master-locale.json present') : bad('master-locale.json missing');

console.log('\n[5] Assets module');
for (const f of ['assets.json', 'index.json', 'folders.json']) existsSync(join(PACK, 'assets', f)) ? ok('assets/' + f) : bad('assets/' + f + ' missing');
const aidx = existsSync(join(PACK, 'assets', 'index.json')) ? rd('assets', 'index.json') : {};
for (const [uid, rec] of Object.entries(aidx)) {
  const fp = join(PACK, 'assets', 'files', uid, rec.filename);
  existsSync(fp) ? ok('binary: ' + rec.filename) : bad('binary MISSING: ' + fp);
  if (existsSync(fp)) String(statSync(fp).size) === rec.file_size ? ok('file_size matches (' + rec.file_size + ')') : bad('file_size mismatch');
  // The url is regenerated on import; a foreign CDN url baked into the record is a
  // leftover from an export elsewhere and should not ship. Empty or a contentstack
  // host is fine; anything else is flagged.
  (rec.url && !/(^$)|contentstack/i.test(rec.url)) ? bad('foreign CDN url in asset record: ' + rec.url) : ok('no foreign CDN url in record');
}

console.log('\n[6] Banner media wired to a shipped asset');
const bn = rd('entries', 'simple_banner_component', 'en-us', 'en-us-entries.json');
const m = bn.seed_banner && bn.seed_banner.media;
m && aidx[m.uid] ? ok('seed_banner.media → ' + m.uid) : wn('banner has no media wired (imageless banner)');

console.log('\n[7] Secret scan (placeholder blt0… uids allowed)');
let secrets = 0;
const TOKEN = /(cs[a-f0-9]{16,})|(management_token|delivery_token|authtoken)\s*[:=]/i;
const BLT = /blt(?!0{10})[a-f0-9]{16}/i; // real-looking stack/asset key, NOT the blt0000… placeholders
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(json|md|mjs)$/.test(f)) {
      const t = readFileSync(p, 'utf8');
      if (TOKEN.test(t) || BLT.test(t)) { console.log('     review:', p.replace(PACK + '/', '')); secrets++; }
    }
  }
})(PACK);
secrets ? bad(secrets + ' possible secret(s)') : ok('no tokens/keys committed');

console.log('\n' + (fail ? `❌ PRE-FLIGHT: ${fail} blocker(s), ${warn} warning(s)` : `✅ PRE-FLIGHT PASS (${warn} warning(s)) — pack is import-ready`));
process.exit(fail ? 1 : 0);
