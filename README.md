# @contentstack/contentstack-spartacus-connector

An open-source Angular feature library that makes **Contentstack** the CMS engine
for an **SAP Composable Storefront (Spartacus)**, while **SAP Commerce (OCC)**
remains the commerce engine.

It overrides Spartacus's CMS adapter layer so page and component content resolve
from Contentstack's Content Delivery API instead of `/occ/v2/{site}/cms/pages`.
Product data still hydrates live from SAP at render time.

> Status: `0.1.0` — framework core (validated end-to-end against a real Spartacus
> app + SAP OCC + Contentstack), Live Preview / Visual Editor bindings, and the
> `ng add` schematic installer (validated end-to-end against a real Spartacus app).
> The content model, a reference storefront, and B2B support remain separate
> deliverables.

## What it does

| Concern | How |
| --- | --- |
| Intercept CMS routing | `ContentstackCmsPageAdapter` / `ContentstackCmsComponentAdapter` replace the OCC adapters and query Contentstack by URL slug |
| Translate the payload | `ContentstackCmsPageNormalizer` maps the `cms_page` schema (named per-slot reference fields → resolved component entries) into Spartacus's native `CmsStructureModel` (page → slots → components), mapping slot field uids to SAP slot names and content-type uids to SAP typecodes |
| Map content types to components | `CmsConfig.cmsComponents` maps each SAP typecode (e.g. `SimpleResponsiveBannerComponent`) to an Angular component |
| Resolve component-specific fields | `ContentstackCmsComponentNormalizer` composes three content-type-specific normalizers by typecode (`cms/converters/components/`): banner media (`media_container` or a direct file field), navigation (flat `nav_node_flat` `all_nodes` pool reassembled into a `CmsNavigationNode` tree by `parent_id`), product carousel (OCC product URLs → `productCodes`) |
| Hydrate SAP data | Components read the SAP SKU from Contentstack and pull live price/stock/add-to-cart via Spartacus `ProductService` / `ActiveCartFacade` (see `src/examples/hero-banner`) |
| Bypass SAP SmartEdit | Never imports `SmartEditRootModule`; `smartEditBypassGuard` neutralizes inbound preview params |
| Code-split the integration | `ContentstackCmsFeatureModule` (the module you import) only registers config; the actual CMS override + Live Preview wiring lives in `ContentstackModule`, lazy-loaded via `CmsConfig.featureModules` — the same convention every real Spartacus feature library uses |

## Supported features & known limitations

**Supported**

| Capability | Notes |
| --- | --- |
| Hybrid rendering | OCC serves the base page + all commerce data; Contentstack overrides authored slots. `occFallback: true` (default) keeps unauthored slots/pages on OCC. |
| Flat navigation | Header + footer menus of any depth via the `*_flat` adjacency-list model (`all_nodes` pool + text `parent_id`) — resolves in a constant, shallow include chain, so the Delivery API's plan-gated reference-depth cap never applies. |
| Editorial components | Banner, responsive banner, product carousel, paragraph, tab paragraph, link, flex → stock Spartacus components by SAP typecode; no `cmsComponents` config needed. |
| Multi-language | `localeMapping` (site isocode → Contentstack locale) plus master-locale fallback; `includeFallback` adds query-time fallback. |
| Live Preview / Visual Builder | Entry tagging + live updates via `CsEditableDirective` / `CsEmptyBlockParentDirective` (non-production). |
| Access gating | Opt-in per-entry `access_tags` (`_require-login`, `_require-anonymous`, `_require-<roleGroupId>`). |

**Known limitations**

| Limitation | Detail |
| --- | --- |
| Page-type resolution | Per-route pages resolve against the single `cmsPageContentType` (the starter pack authors the home as `landing_page`). **Shared-layout** types (product, category) get their own content type via `pageTypeMapping` (`contentTypeUid` + `sharedSlug`) — the pack ships `product_page` / `category_page` for this. Serving multiple *distinct per-route* content types isn't supported yet; unmapped page types fall back to OCC. |
| Reference fields, not Modular Blocks | Slots are multi-reference fields; the connector resolves referenced component entries via `includeReference`. Contentstack **Modular Blocks** (inline composed blocks) are **not** read — model components as separate content types referenced from the page/shell. |
| Author into slots the template renders | A component shows only if the SAP page template renders its slot. `LandingPage2Template` renders `Section1`, `Section2A/2B/2C`, `Section3`–`Section5` — there is **no bare `Section2`** (that's `CategoryPageTemplate`), and `Section2A/2B/2C` are narrow 1/3-width columns, so full-width content belongs in `Section1`/`Section3`–`5`. |
| Access gating is presentation-level | Hides content in the client based on the user's SAP login state / role groups — **not** a server-side security boundary. Off by default (`accessControl.enabled: false`). |
| Shared-slug product/category pages | One shared entry serves every PDP / PLP; product and facet data always come from OCC. |
| Live Preview is non-production | Ignored in production builds; the `previewToken` grants draft read access — treat it as a secret, keep it out of committed source and prod. |
| Content i18n only | Content localizes via Contentstack locales; Spartacus's own UI-label i18n is unchanged. |

## Architecture

```
Navigation ─▶ Spartacus CmsPageConnector ─▶ CmsPageAdapter (abstract)
                                              └─▶ ContentstackCmsPageAdapter   ← this lib
                                                    ├─ ContentstackClientService ─▶ Contentstack Delivery API
                                                    └─ ContentstackCmsPageNormalizer ─▶ CmsStructureModel
                                                                                          │
Spartacus rendering engine (PageLayout → PageSlot → ComponentWrapper) ◀───────────────────┘
   └─ resolves each slot component via CmsConfig.cmsComponents ─▶ your Angular component
          └─ reads SAP SKU from Contentstack ─▶ ProductService ─▶ live price / stock (SAP OCC)
```

## Install (into a real Spartacus app)

> **New to this connector?** See **`GETTING_STARTED.md`** for the full step-by-step walkthrough
> (content modeling, wiring, and how to verify it worked). The summary below assumes you've
> already read that or know the shape.

```bash
npm install @contentstack/contentstack-spartacus-connector @contentstack/delivery-sdk
```

1. **Import the feature module** — *after* the base Spartacus modules so the
   adapter overrides win (DI "last provider wins"; the base includes
   `CmsOccModule`). In a standard `ng add @spartacus/schematics` app, add it in
   `SpartacusFeaturesModule` or after `StorefrontModule`:

   ```ts
   import { ContentstackCmsFeatureModule } from '@contentstack/contentstack-spartacus-connector';
   import { ContentstackConfig } from '@contentstack/contentstack-spartacus-connector';
   import { provideConfig } from '@spartacus/core';
   import { Region } from '@contentstack/delivery-sdk';

   @NgModule({
     imports: [ContentstackCmsFeatureModule],
     providers: [
       provideConfig(<ContentstackConfig>{
         contentstack: {
           delivery: {
             apiKey: environment.cs.apiKey,
             deliveryToken: environment.cs.deliveryToken,
             environment: 'production',
             region: Region.EU,
           },
           cmsPageContentType: 'cms_page',
           slugField: 'url',
           // includeReferences defaults to all cms_page slot + header/footer
           // fields (so components resolve inline) — override only to narrow it.
         },
       }),
     ],
   })
   export class ContentstackFeatureModule {}
   ```

2. **Map your content/component types to components** — follow the pattern in
   `src/examples/hero-banner/custom-hero.module.ts`. The `cmsComponents` map key
   **must equal** the SAP typecode the normalizer emits (e.g.
   `SimpleResponsiveBannerComponent`), mapped from the Contentstack content-type
   uid via `src/cms/model/slot-maps.ts` (custom types fall back to their raw uid).

3. **(Optional) SmartEdit bypass guard** — attach `smartEditBypassGuard` to your
   content route to strip legacy SmartEdit preview params.

## Connect to your stack

Four values point the storefront at your Contentstack stack:

| Value | Where to get it |
|---|---|
| `apiKey` | Settings → Stack settings → **API Key** |
| `deliveryToken` | Settings → Tokens → **Delivery Tokens** (scope it to your environment) |
| `environment` | your publishing environment, e.g. `development` |
| `region` | your stack's data center (`Region.US` / `EU` / `AZURE_NA` / …) |

Put them in `src/environments/contentstack.environment.ts` — copy
[`contentstack.environment.example.ts`](contentstack.environment.example.ts) as a starting
point (or let `ng add` generate it). Then set `cmsPageContentType` (the starter pack authors the
home as `landing_page`) and, for a localized site, `localeMapping`.

**Secret hygiene:** `apiKey` + `deliveryToken` are read-only and safe in the client bundle. A
`previewToken` (Live Preview only) is a **secret** — keep it out of committed source; `.env*` is
already gitignored, and you can gitignore the real credentials file or swap it per build via
Angular `fileReplacements`.

## Configuration reference

Every option lives on the `ContentstackConfig` interface (`src/config/contentstack-config.ts`)
and is **fully typed** — because the library augments Spartacus's `Config`, your editor
autocompletes and type-checks the whole `provideConfig(<ContentstackConfig>{ contentstack: … })`
block, with each field's JSDoc on hover. The complete set:

**`contentstack.delivery`** — connection & credentials

| Option | Required | Default |
| --- | --- | --- |
| `apiKey` | yes | — |
| `deliveryToken` | yes | — |
| `environment` | yes | — |
| `region` | | `Region.US` |
| `branch` | | `main` |
| `livePreview` | | `false` |
| `previewToken` | when `livePreview` | — |
| `previewHost` | | US preview host |

**`contentstack`** — behavior

| Option | Default / note |
| --- | --- |
| `cmsPageContentType` | page content type queried by slug (the starter pack uses `landing_page`) |
| `slugField` | `url` — field holding the page slug |
| `slugTransform` | `{ pattern, replacement }` regex rewrite of the route slug before querying |
| `localeMapping` | site isocode → Contentstack locale (e.g. `{ en: 'en-us' }`); identity fallback |
| `includeFallback` | `false` — request master-locale fallback for unlocalized entries |
| `occFallback` | `true` — hybrid (OCC base + CS overrides); `false` = full-replacement |
| `globalSlots` | `{ contentType, title? }` — shared shell merged into every page |
| `pageTypeMapping` | per-`PageType` `{ contentTypeUid, slugField?, sharedSlug? }` (shared-layout pages) |
| `additionalSlotFields` | extra `{ fieldUid: 'SapSlotPosition' }` beyond the built-in slot map |
| `componentContentType` | content type for standalone component lookups (else components ship in pages) |
| `componentTypeMapping` | block uid → SAP typeCode (for author-named blocks without a `type_code`) |
| `includeReferences` | reference fields to expand; defaults to all slot + header/footer fields |
| `accessControl` | presentation-level gating — see below |
| `timeoutMs` | `10000` — Delivery API call timeout |

**`contentstack.accessControl`** — opt-in content gating (see also `CONTENT-MODEL.md` §4.5)

| Option | Default |
| --- | --- |
| `enabled` | `false` |
| `accessField` | `access_tags` |
| `anonymousToken` | `_require-anonymous` |
| `loginToken` | `_require-login` |
| `rolePrefix` | `_require-` (role `b2badmingroup` → `_require-b2badmingroup`) |
| `gateSharedSlugPages` | `false` |

Set `delivery.livePreview: true` (with a `previewToken`) to enable Live Preview / Visual Builder;
import the library's `CsEditableDirective` / `CsEmptyBlockParentDirective` in your slot/component
templates for per-field and empty-slot editing.

## Verification

This library targets `@spartacus/*` public contracts; full end-to-end run
requires a live SAP OCC backend + Contentstack stack. In-repo verification:

- **Typecheck against contracts** (offline gate):
  ```bash
  npm run typecheck
  ```
  Resolves `@angular/*`/`rxjs`/`@ngrx/store` from this repo's own `node_modules`
  (install as devDependencies — they're genuinely on the public registry) and
  `@spartacus/*` / `@spartacus/schematics` from `typings/` (transcribed from the
  real Spartacus source). Exit 0 = our adapters, normalizers, LP/VE services,
  and schematic conform to the real contract shapes. (Previously pointed at a
  sibling `../spartacus/` monorepo — not required anymore.)
- **Unit tests**:
  - `npm test` — `contentstack-cms-page.normalizer.spec.ts` / `contentstack-cms-component.normalizer.spec.ts` plus the three component-specific normalizer specs (`cms/converters/components/*.normalizer.spec.ts`) and `cms/model/type-guards.spec.ts`, all pure-logic Contentstack→Spartacus transforms via lightweight stubs (`test/stubs/`). `contentstack-cms.module.spec.ts` and `examples/hero-banner/custom-hero.component.spec.ts` need the full Angular + Spartacus runtime and are intentionally not matched here — verify those inside an integrated Spartacus host app.
  - `npm run test:schematics` — the `ng add` schematic via the real `SchematicTestRunner`, against a test-only `@spartacus/schematics` stub (`test/stubs/spartacus-schematics.stub.ts`) compiled into a real local package (the schematics engine `require()`s it directly at Node runtime; see the stub's doc comment). Verifies `collection.json`/`schema.json` wiring, not Spartacus's real installer behavior end to end.
  - `npm run test:all` — both of the above.

## Notes
- `typings/` shims exist only for the offline typecheck; they are unused once the
  real `@spartacus/*` / `@contentstack/delivery-sdk` packages are installed.
- See `GETTING_STARTED.md` for a full installation walkthrough and
  `TROUBLESHOOTING.md` for common integration issues.

## License
MIT
