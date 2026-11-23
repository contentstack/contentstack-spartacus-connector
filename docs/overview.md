---
title: "Overview"
product: spartacus-connector
type: overview
tags: [spartacus-connector, overview]
last_updated: "2026-09-21"
---

# Overview

`@contentstack/contentstack-spartacus-connector` is an open-source Angular feature library that makes **Contentstack** the CMS engine for an **SAP Composable Storefront (Spartacus)**, while **SAP Commerce (OCC)** remains the commerce engine.

It overrides Spartacus's CMS adapter layer so page and component content resolves from Contentstack's **Content Delivery API** instead of `/occ/v2/{site}/cms/pages`; product/cart/checkout data still hydrates live from SAP. The full SAP shell, navigation, footer, and every functional page (login, cart, checkout, order, track) keep rendering from OCC — only the marketing content you choose to author moves into the headless CMS.

See the [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) document for the design rationale. This page is the practical summary; jump to [installation](installation.md) to get it running.

---

## What it does

At its core the connector is a small stack of Spartacus adapter overrides plus payload normalizers: Spartacus asks its CMS layer for a page by URL, the connector answers from Contentstack, translates the payload into a native `CmsStructureModel`, and steps out of the way so Spartacus renders it. Commerce data is never in that payload — components read a SAP SKU from the entry and hydrate live from SAP.

| Concern | How |
|---|---|
| **Intercept CMS routing** | `ContentstackCmsPageAdapter` / `ContentstackCmsComponentAdapter` replace the OCC adapters and query Contentstack by URL slug. |
| **Translate the payload** | `ContentstackCmsPageNormalizer` maps the page schema into Spartacus's `CmsStructureModel` (page → slots → components), mapping slot field uids to SAP slot names and content-type uids to SAP typecodes. |
| **Map content types to components** | `CmsConfig.cmsComponents` maps each SAP typecode to an Angular component. |
| **Resolve component-specific fields** | `ContentstackCmsComponentNormalizer` composes banner, navigation, and product-carousel normalizers by typecode. |
| **Hydrate SAP data** | Components read the SAP SKU from Contentstack and pull live price/stock/add-to-cart via `ProductService` / `ActiveCartFacade`. |
| **Bypass SAP SmartEdit** | Never imports `SmartEditRootModule`; `smartEditBypassGuard` neutralizes inbound preview params. |
| **Bundle the integration** | `ContentstackCmsFeatureModule` registers config and eagerly imports the CMS adapter override + Live Preview modules. |

In the default **hybrid** mode (`occFallback: true`), OCC returns the base page for every route and Contentstack overrides only the slots you have authored — the "editable islands." See [architecture](architecture.md) for the override chain and [concepts](concepts.md) for the mental model.

---

## Supported features

What a normally-scaffolded Spartacus app gets after wiring in the connector and importing the content-model starter pack:

| Capability | Notes |
|---|---|
| **Hybrid rendering** | OCC serves the base page + all commerce data; Contentstack overrides authored slots. `occFallback: true` (default) keeps unauthored slots/pages on OCC. |
| **Flat navigation** | Header + footer menus of any depth via the `*_flat` adjacency-list model — resolves in a constant, shallow include chain, so the Delivery API's plan-gated reference-depth cap never applies. |
| **Editorial components** | Banner, responsive banner, product carousel, paragraph, tab paragraph, link, flex → stock Spartacus components by SAP typecode; no `cmsComponents` config needed. |
| **Multi-language** | `localeMapping` (site isocode → Contentstack locale) plus master-locale fallback; `includeFallback` adds query-time fallback. |
| **Live Preview / Visual Builder** | Entry tagging + live updates via `CsEditableDirective` / `CsEmptyBlockParentDirective` (non-production). See [live-preview](live-preview.md). |
| **Access gating** | Opt-in per-entry `access_tags` (`_require-login`, `_require-anonymous`, `_require-<roleGroupId>`). See [access-control](access-control.md). |

Two are worth calling out for installers:

- **Hybrid rendering** keeps the migration low-risk: an app that imports the connector but authors *nothing* in Contentstack renders identically to before. On an authored page, DevTools → Network shows calls to **both** `cdn.contentstack.io` (authored content) and `/occ/v2/...` (base + commerce) — that dual traffic is the signature of hybrid mode working.
- **Editorial components** map to *stock* Spartacus components automatically; you only add a `cmsComponents` entry for your **own** component (see the `src/examples/hero-banner` pattern).

The rationale behind each feature (why flat navigation, why references not modular blocks) lives in the [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) document.

---

## Known limitations

Deliberate boundaries of the current design, not bugs — knowing them tells you how to model content so it renders where you expect.

| Limitation | Detail |
|---|---|
| **Page-type resolution** | Per-route pages resolve against a single `cmsPageContentType`. **Shared-layout** types (product, category) get their own content type via `pageTypeMapping`. Serving multiple *distinct per-route* content types isn't supported yet; unmapped page types fall back to OCC. |
| **Reference fields, not Modular Blocks** | Slots are multi-reference fields resolved via `includeReference`. Contentstack **Modular Blocks** are **not** read — model components as separate content types referenced from the page/shell. |
| **Author into slots the template renders** | A component shows only if the SAP page template renders its slot. `LandingPage2Template` renders `Section1`, `Section2A/2B/2C`, and `Section3`–`Section5` — there is **no bare `Section2`** (that name belongs to `CategoryPageTemplate`), and `Section2A/2B/2C` are narrow one-third-width columns. Full-width content belongs in `Section1` or `Section3`–`Section5`. |
| **Access gating is presentation-level** | Hides content in the client based on SAP login state / role groups — **not** a server-side security boundary. Off by default. |
| **Shared-slug product/category pages** | One shared entry serves every PDP / PLP; product and facet data always come from OCC. |
| **Live Preview is non-production** | Ignored in production builds; the `previewToken` grants draft read access — treat it as a secret. |
| **Content i18n only** | Content localizes via Contentstack locales; Spartacus's own UI-label i18n is unchanged. |

See [concepts › Page-type resolution](concepts.md#page-type-resolution) and [content-model](content-model.md) for how to model around these, and the [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) document for why each boundary exists.

---

## What it is not

- **Not a commerce replacement.** Products, cart, checkout, users, and pricing stay in SAP Commerce and hydrate live. A component may store a SAP SKU in Contentstack, but price, stock, and add-to-cart still come from OCC via `ProductService` / `ActiveCartFacade`.
- **Not a full-storefront CMS by default.** In hybrid mode you author only the slots you want; the shell, navigation, footer, and functional pages render from OCC. Full-replacement mode (`occFallback: false`) exists, but hybrid is the intended and validated default.
- **Not a security boundary.** [Access gating](access-control.md) tailors what the UI shows; it does not protect confidential data. The delivery token ships in the client bundle and is read-only, so any delivered content is reachable regardless of gating tags. Gate for presentation, not secrecy.

---

## Status

`0.1.0`.

- **Validated end-to-end** (real Spartacus app + SAP OCC + Contentstack): framework core, Live Preview / Visual Editor bindings, and the `ng add` schematic installer.
- **Ships in the repo:** the content-model starter pack (`import-export/starter-pack/`), imported via `csdx` — see [installation](installation.md#step-2-provision-the-content-model-demo-seed-csdx).
- **Tracked separately:** a reference storefront and B2B support.

> [!NOTE]
> This library targets `@spartacus/*` public contracts. A full end-to-end run requires a live SAP OCC backend + a Contentstack stack. In-repo verification is available via `npm run typecheck`, `npm test`, and `npm run test:schematics` — see [Verification](installation.md#verification-in-repo).

---

## Related

- [concepts](concepts.md) — the hybrid model, slots, islands, and the two-token security model
- [architecture](architecture.md) — how the override chain and normalizers work
- [installation](installation.md) — get it running
- [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) — design rationale and constraints
- Repository docs: `README.md`, `GETTING_STARTED.md`, `CONTENT-MODEL.md`, `TROUBLESHOOTING.md`
