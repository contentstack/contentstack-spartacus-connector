---
title: "Concepts"
product: spartacus-connector
type: concepts
tags: [spartacus-connector, concepts]
last_updated: "2026-09-09"
---

# Concepts

The mental model behind the connector. Read this before [architecture](architecture.md) or [content-model](content-model.md).

---

## Hybrid rendering: OCC base + Contentstack islands

The connector runs in **hybrid** mode by default (`occFallback: true`):

- **SAP Commerce (OCC) is the base for every page.** The shell (header, nav, footer), functional pages (login, cart, checkout, order, track), and any unauthored slot render from SAP exactly as they do today.
- **Contentstack overrides only the slots you author.** Author a slot → it becomes an "editable Contentstack island" over the OCC base. Leave it → OCC fills it.

The result: a fully working storefront where you manage just the marketing/editorial content headlessly. Commerce (products, cart, checkout, users) stays in SAP and hydrates live at render time.

> [!NOTE]
> The alternative is **full-replacement** mode (`occFallback: false`), where an unauthored page/slot is *not* backfilled from OCC. Hybrid is the recommended default.

---

## The slot is the unit of control

**Slot names are not arbitrary** — they are Spartacus's template **positions**, defined by the storefront's `LayoutConfig`. A slot only renders if its template declares it.

- You author a **lowercase `snake_case` field** in Contentstack (e.g. `section1`).
- The connector maps it to the **PascalCase SAP position** (e.g. `Section1`) via `SLOT_FIELD_TO_SAP_NAME` in [`src/cms/model/slot-maps.ts`](../src/cms/model/slot-maps.ts).

Because a component only shows when the SAP page template renders its slot, you must author into slots the active template actually declares. See the slot reference in [Slot reference](content-model.md#slot-reference).

---

## Content types map to SAP typecodes

Each Contentstack **content type uid** maps to a SAP **typeCode** (e.g. `simple_responsive_banner_component` → `SimpleResponsiveBannerComponent`). The normalizer emits that typeCode, and Spartacus's `CmsConfig.cmsComponents` map resolves it to an Angular component.

- The editorial starter-pack types map to **stock** Spartacus components automatically — no `cmsComponents` config needed.
- You only add a `cmsComponents` entry for **your own** custom components. The map key **must equal** the emitted typeCode exactly (a custom content type not in the slot map falls back to its raw uid).

---

## References, not Modular Blocks

Slots are **multi-reference fields**. The connector resolves the referenced component entries inline via the Delivery SDK's `includeReference`. Contentstack **Modular Blocks** (inline composed blocks) are **not** read — model components as separate content types referenced from the page or shell.

The `includeReferences` config controls which reference fields are expanded (defaults to all page slot + header/footer fields). Nested references — like a banner's own `media_container` — need their full path added explicitly. See [Media Container](content-model.md#media-container-resolving-a-nested-reference).

---

## Page-type resolution

- **Per-route content/landing pages** (including the homepage) resolve against a single `cmsPageContentType`, queried by slug. The starter pack authors the home as `landing_page`.
- **Shared-layout pages** (product detail, category/list) use `pageTypeMapping` to point a `PageType` at its own `contentTypeUid` and a `sharedSlug` — one shared entry serves every PDP/PLP, and product/facet data always come from OCC.
- **Unmapped page types fall back to OCC.**

The homepage is special: the connector maps Spartacus's `HOME_PAGE_CONTEXT` to the slug `/`, so the home entry's slug field must be exactly `/`. When OCC's route and the CMS slug don't match byte-for-byte (locale/category prefixes, etc.), use `slugTransform` to rewrite the route before querying rather than reauthoring entries. See [troubleshooting](troubleshooting.md).

---

## The two-token security model

| Token | Used where | Nature |
|---|---|---|
| **Delivery token** (+ API key) | The storefront, at runtime | Read-only; safe in the client bundle. |
| **`csdx auth:login`** (or a scoped management token) | Your dev machine, one-time content-model import | Privileged; never committed, never shipped. |
| **Preview token** | Non-production Live Preview builds only | **Secret** — grants read access to unpublished drafts; keep out of committed source. |

The storefront only ever uses the read-only delivery token. The privileged credential exists solely for the one-time starter-pack import. See [Provision the content model](installation.md#step-2-provision-the-content-model-demo-seed-csdx).

---

## DI ordering: last provider wins (and fails silently)

The connector overrides Spartacus's abstract `CmsPageAdapter` / `CmsComponentAdapter` tokens and relies on Angular DI's **last-provider-wins** rule. `ContentstackCmsFeatureModule` must be imported **after** the base Spartacus modules (which include `CmsOccModule`).

> [!WARNING]
> If the feature module is imported *before* the base modules — or omitted — the OCC adapters win the DI race, pages keep rendering from SAP OCC, and **no error is thrown**. The integration simply does nothing. If content isn't coming from Contentstack, check import ordering first. See [Module composition and DI ordering](architecture.md#module-composition-and-di-ordering) and [troubleshooting](troubleshooting.md).

---

## Eager, not lazy

`ContentstackCmsFeatureModule` **eagerly** imports the CMS adapter override and Live Preview modules — the adapter resolves the very first page at bootstrap, and the Live Preview decorator is consulted as components render. The standard lazy `CmsConfig.featureModules` gate is deliberately not used (it only fires for a feature-tagged `cmsComponents` entry, which this library never registers).

---

## Related

- [architecture](architecture.md) — the concrete override chain and normalizer pipeline
- [content-model](content-model.md) — slots, content types, and the seed
- [configuration](configuration.md) — every knob these concepts expose
