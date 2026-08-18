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
| Resolve component-specific fields | `ContentstackCmsComponentNormalizer` composes three content-type-specific normalizers by typecode (`cms/converters/components/`): banner media (`media_container` or a direct file field), navigation (recursive `nav_node` walk into `CmsNavigationNode`), product carousel (OCC product URLs → `productCodes`) |
| Hydrate SAP data | Components read the SAP SKU from Contentstack and pull live price/stock/add-to-cart via Spartacus `ProductService` / `ActiveCartFacade` (see `src/examples/hero-banner`) |
| Bypass SAP SmartEdit | Never imports `SmartEditRootModule`; `smartEditBypassGuard` neutralizes inbound preview params |
| Code-split the integration | `ContentstackCmsFeatureModule` (the module you import) only registers config; the actual CMS override + Live Preview wiring lives in `ContentstackModule`, lazy-loaded via `CmsConfig.featureModules` — the same convention every real Spartacus feature library uses |

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

See `ContentstackConfig` (`src/config/contentstack-config.ts`). Key fields:
`delivery.{apiKey,deliveryToken,environment,region,branch,livePreview}`,
`cmsPageContentType`, `slugField`, `slugTransform`, `pageTypeMapping`, `includeReferences`,
`accessControl` (opt-in presentation-level content gating — see `CONTENT-MODEL.md` §4.5)
(defaults to all slot + header/footer fields), `timeoutMs`, and
`componentContentType` (only for standalone component lookups — see D9).
Set `delivery.livePreview: true` to enable Live Preview / Visual Editor
(entry tagging + live updates); import the library's `CsEditableDirective` /
`CsEmptyBlockParentDirective` in your slot/component templates for per-field
and empty-slot editing.

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
