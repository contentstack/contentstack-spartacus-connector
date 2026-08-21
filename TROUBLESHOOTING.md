# Troubleshooting

Issues collected from actually building and running this connector end-to-end against a real
Spartacus app, a live SAP OCC backend, and a live Contentstack stack. Two of these were real
bugs and are already fixed in this repo — kept here because the *shape* of the mistake is worth
knowing if you extend the client or config wiring yourself.

---

### A slot renders blank / nothing shows for a block

**Cause:** the `cmsComponents` map key doesn't exactly match the `typeCode` the normalizer emits.

**Fix:** the key in your `provideDefaultConfig(<CmsConfig>{ cmsComponents: { ... } })` must be
*identical* to the SAP typecode the normalizer emits — the referenced component's Contentstack
content-type uid mapped through `src/cms/model/slot-maps.ts` (e.g. content type
`simple_responsive_banner_component` → typeCode `SimpleResponsiveBannerComponent`; a custom type
not in the map falls back to its raw uid). Not a display name or arbitrary label. This is the most
common first mistake — see `custom-hero.module.ts` for a working example.

---

### `No provider found for ContentstackConfig`

**Cause:** the typed `ContentstackConfig` accessor wasn't bound to Spartacus's merged global
`Config` token. (This was a real bug in this library, fixed by adding
`{ provide: ContentstackConfig, useExisting: Config }` to `ContentstackCmsFeatureModule`.)

**Fix:** always import **`ContentstackCmsFeatureModule`** (not just `ContentstackCmsModule` on
its own) — the binding lives there. If you see this on a very old checkout, pull latest.

---

### `Property 'includeReference' does not exist on type 'Query'`

**Cause:** in `@contentstack/delivery-sdk`, `includeReference()` lives on the `Entries` object
(from `.entry()`), not on `Query` (from `.query()`). (Also a real bug here, already fixed in
`ContentstackClientService`.)

**Fix:** if you extend or fork the client service, call `.includeReference(...)` on the result of
`.entry()` *before* chaining `.query()`, not after.

---

### Standalone component lookup returns empty + a console warning

**Symptom:** `[ContentstackCmsComponentAdapter] load(...)` / `findComponentsByIds(...)` warns
"contentstack.componentContentType is not configured" and returns nothing.

**Cause:** this is expected — the primary path delivers component data embedded in the page
payload (via the page normalizer), so the component adapter is only exercised when Spartacus
requests a shared/reusable component by uid that isn't already in the CMS store.

**Fix:** only set `contentstack.componentContentType` if you actually use standalone/shared
components outside a page's `modular_blocks`. Otherwise this warning is harmless.

---

### The homepage (or a specific page) never resolves

**Cause:** the connector maps Spartacus's `HOME_PAGE_CONTEXT` to the slug `/`. If your homepage
entry's `url` field isn't literally `/`, the query returns nothing.

**Fix:** make sure the homepage entry's slug field value is exactly `/`, or adjust
`slugField`/your content model to match. The same root cause — OCC's route not
matching the CMS-authored slug byte-for-byte — can happen on any content page,
not just the homepage (e.g. a locale or category prefix OCC includes that the
CMS entry omits). Rather than reauthoring every entry's slug, configure
`slugTransform: { pattern, replacement }` to rewrite the route before it's
queried; see its JSDoc on `ContentstackConfig` for an example.

---

### `ERR_CERT_AUTHORITY_INVALID` or `Http failure response ... 0 undefined` calling OCC

**Cause:** a self-signed TLS certificate on a dev/local SAP Commerce backend — normal for
non-production environments, and enforced strictly by real browsers (unlike `curl`).

**Fix (dev only):**
- **Browser (CSR):** open the OCC base URL directly once and click through the security warning
  to add an exception for that origin.
- **Node/SSR:** run the server with `NODE_TLS_REJECT_UNAUTHORIZED=0` (dev only — never in
  production; production SAP Commerce deployments have valid certs, so this doesn't apply there).

---

### `ng add @spartacus/schematics` installs an old Spartacus (v4.x, Angular 12)

**Cause:** public npm's `@spartacus/*` packages haven't been updated in years and cap out around
`4.3.8`. The current Angular-21-era Composable Storefront line is distributed **only** via SAP's
private RBSC registry, which requires an SAP Universal ID.

**Fix:** register for RBSC access, or — if you already have a modern Spartacus source vendored
locally — consume that directly instead of via public npm.

---

### A code/config fix doesn't seem to take effect after rebuilding

**Cause:** (monorepo/local-dev setups only) your build tool cached the previous output, and the
connector — consumed via a symlink or tsconfig path mapping rather than a real npm-published
version — isn't tracked as a build input, so the cache isn't invalidated.

**Fix:** force a clean/no-cache rebuild (e.g. `nx run <app>:build --skip-nx-cache`). Not
applicable if you installed this package normally from npm.

---

### Console warnings `NG05001` / `NG0505` about hydration

**Cause:** benign, and expected on a pure client-side (`noSsr`) build — Angular notices there's no
server-rendered payload to hydrate into. Not a functional error; the page still renders correctly.

**Fix:** none needed. If you're running SSR and see this, double-check `provideClientHydration()`
is configured in your server bootstrap.
