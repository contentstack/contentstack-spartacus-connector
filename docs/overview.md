---
title: "Overview"
product: spartacus-connector
type: overview
tags: [spartacus-connector, overview]
last_updated: "2026-09-09"
---

# Overview

`@contentstack/contentstack-spartacus-connector` is an open-source Angular feature library that makes **Contentstack** the CMS engine for an **SAP Composable Storefront (Spartacus)**, while **SAP Commerce (OCC)** remains the commerce engine.

It overrides Spartacus's CMS adapter layer so page and component content resolve from Contentstack's **Content Delivery API** instead of `/occ/v2/{site}/cms/pages`. Product data still hydrates live from SAP at render time.

---

## What it does

| Concern | How |
|---|---|
| **Intercept CMS routing** | `ContentstackCmsPageAdapter` / `ContentstackCmsComponentAdapter` replace the OCC adapters and query Contentstack by URL slug. |
| **Translate the payload** | `ContentstackCmsPageNormalizer` maps the page schema (named per-slot reference fields → resolved component entries) into Spartacus's native `CmsStructureModel` (page → slots → components), mapping slot field uids to SAP slot names and content-type uids to SAP typecodes. |
| **Map content types to components** | `CmsConfig.cmsComponents` maps each SAP typecode (e.g. `SimpleResponsiveBannerComponent`) to an Angular component. |
| **Resolve component-specific fields** | `ContentstackCmsComponentNormalizer` composes three content-type-specific normalizers by typecode: banner media, navigation (flat adjacency-list rebuilt into a tree), and product carousel (OCC product URLs → `productCodes`). |
| **Hydrate SAP data** | Components read the SAP SKU from Contentstack and pull live price/stock/add-to-cart via Spartacus `ProductService` / `ActiveCartFacade`. |
| **Bypass SAP SmartEdit** | Never imports `SmartEditRootModule`; `smartEditBypassGuard` neutralizes inbound preview params. |
| **Bundle the integration** | `ContentstackCmsFeatureModule` (the module you import) registers config and eagerly imports the CMS adapter override + Live Preview modules. |

See [architecture](architecture.md) for how these fit together and [concepts](concepts.md) for the mental model behind them.

---

## Supported features

| Capability | Notes |
|---|---|
| **Hybrid rendering** | OCC serves the base page + all commerce data; Contentstack overrides authored slots. `occFallback: true` (default) keeps unauthored slots/pages on OCC. |
| **Flat navigation** | Header + footer menus of any depth via the `*_flat` adjacency-list model — resolves in a constant, shallow include chain, so the Delivery API's plan-gated reference-depth cap never applies. |
| **Editorial components** | Banner, responsive banner, product carousel, paragraph, tab paragraph, link, flex → stock Spartacus components by SAP typecode; no `cmsComponents` config needed. |
| **Multi-language** | `localeMapping` (site isocode → Contentstack locale) plus master-locale fallback; `includeFallback` adds query-time fallback. |
| **Live Preview / Visual Builder** | Entry tagging + live updates via `CsEditableDirective` / `CsEmptyBlockParentDirective` (non-production). See [live-preview](live-preview.md). |
| **Access gating** | Opt-in per-entry `access_tags` (`_require-login`, `_require-anonymous`, `_require-<roleGroupId>`). See [access-control](access-control.md). |

---

## Known limitations

| Limitation | Detail |
|---|---|
| **Page-type resolution** | Per-route pages resolve against a single `cmsPageContentType`. **Shared-layout** types (product, category) get their own content type via `pageTypeMapping`. Serving multiple *distinct per-route* content types isn't supported yet; unmapped page types fall back to OCC. |
| **Reference fields, not Modular Blocks** | Slots are multi-reference fields resolved via `includeReference`. Contentstack **Modular Blocks** are **not** read — model components as separate content types referenced from the page/shell. |
| **Author into slots the template renders** | A component shows only if the SAP page template renders its slot. |
| **Access gating is presentation-level** | Hides content in the client based on SAP login state / role groups — **not** a server-side security boundary. Off by default. |
| **Shared-slug product/category pages** | One shared entry serves every PDP / PLP; product and facet data always come from OCC. |
| **Live Preview is non-production** | Ignored in production builds; the `previewToken` grants draft read access — treat it as a secret. |
| **Content i18n only** | Content localizes via Contentstack locales; Spartacus's own UI-label i18n is unchanged. |

---

## What it is not

- **Not a commerce replacement.** Products, cart, checkout, users, and pricing stay in SAP Commerce and hydrate live. The connector only takes over the CMS/content layer.
- **Not a full-storefront CMS by default.** In the default hybrid mode you only author the slots you want; everything else renders from OCC.
- **Not a security boundary.** [Access gating](access-control.md) tailors what the UI shows; it does not protect confidential data (the delivery token ships in the client bundle).

---

## Status

`0.1.0`.

- **Validated end-to-end** (real Spartacus app + SAP OCC + Contentstack): framework core, Live Preview / Visual Editor bindings, and the `ng add` schematic installer.
- **Separate deliverables:** the content-model starter pack, a reference storefront, and B2B support.

> [!NOTE]
> This library targets `@spartacus/*` public contracts. A full end-to-end run requires a live SAP OCC backend + a Contentstack stack. In-repo verification is available via `npm run typecheck`, `npm test`, and `npm run test:schematics` — see [Verification](installation.md#verification-in-repo).

---

## Related

- [concepts](concepts.md) — the hybrid model, slots, islands, and the two-token security model
- [architecture](architecture.md) — how the override chain and normalizers work
- [installation](installation.md) — get it running
- Repository docs: `README.md`, `GETTING_STARTED.md`, `CONTENT-MODEL.md`, `TROUBLESHOOTING.md`
