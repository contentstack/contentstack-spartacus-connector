---
title: "Architecture"
product: spartacus-connector
type: architecture
tags: [spartacus-connector, architecture]
last_updated: "2026-09-09"
---

# Architecture

How the connector slots into Spartacus's rendering pipeline. For the mental model, read [concepts](concepts.md) first.

---

## The CMS adapter-override chain

Spartacus resolves a page through a chain of abstract adapters. The connector replaces the OCC implementations of those adapters with Contentstack-backed ones:

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

The key move: because these adapters are **abstract DI tokens**, providing a new implementation *after* the OCC one wins the binding (last-provider-wins). No Spartacus core code is patched.

---

## Request flow, end to end

1. **Route change** → Spartacus's `CmsPageConnector` asks the `CmsPageAdapter` to load the page for the current context (slug).
2. **`ContentstackCmsPageAdapter`** ([`src/cms/adapters/contentstack-cms-page.adapter.ts`](../src/cms/adapters/contentstack-cms-page.adapter.ts)) queries Contentstack by slug through **`ContentstackClientService`** ([`src/client/contentstack-client.service.ts`](../src/client/contentstack-client.service.ts)), expanding configured reference fields via the Delivery SDK's `includeReference`.
3. **`ContentstackCmsPageNormalizer`** ([`src/cms/converters/contentstack-cms-page.normalizer.ts`](../src/cms/converters/contentstack-cms-page.normalizer.ts)) translates the entry — named per-slot reference fields, each holding resolved component entries — into Spartacus's native `CmsStructureModel` (page → slots → components). It maps:
   - slot **field uids → SAP slot names** (`SLOT_FIELD_TO_SAP_NAME`), and
   - component **content-type uids → SAP typecodes** (`toTypeCode`).
4. **Component normalization** — for each component, `ContentstackCmsComponentNormalizer` ([`src/cms/converters/contentstack-cms-component.normalizer.ts`](../src/cms/converters/contentstack-cms-component.normalizer.ts)) dispatches by typecode to a content-type-specific normalizer (see below).
5. **Spartacus renders** the `CmsStructureModel` through its normal engine (`PageLayout → PageSlot → ComponentWrapper`), resolving each component via `CmsConfig.cmsComponents`.
6. **Live SAP hydration** — a component reads its SAP SKU from the Contentstack payload and pulls live price/stock/add-to-cart via Spartacus `ProductService` / `ActiveCartFacade` (see [`src/examples/hero-banner`](../src/examples/hero-banner)).

---

## The normalizer pipeline

`ContentstackCmsComponentNormalizer` composes three content-type-specific normalizers, dispatched by typecode ([`src/cms/converters/components/`](../src/cms/converters/components)):

| Normalizer | Handles | What it does |
|---|---|---|
| **Banner** (`contentstack-cms-banner-component.normalizer.ts`) | banner / responsive banner | Resolves media from a nested `media_container` reference or the direct per-breakpoint file fields (`media`, `media_mobile`, …). Falls back to the direct fields if `media_container` isn't expanded. |
| **Navigation** (`contentstack-cms-navigation-component.normalizer.ts`) | header/footer menus | Reassembles a flat `nav_node_flat` `all_nodes` pool into a `CmsNavigationNode` tree by `parent_id`. The flat/adjacency-list model keeps the include chain shallow so the Delivery API's plan-gated reference-depth cap never applies. |
| **Product carousel** (`contentstack-cms-product-carousel-component.normalizer.ts`) | product carousel | Turns OCC product URLs / SKUs into `productCodes` for Spartacus to hydrate. |

Shared field mapping (uid ↔ typecode/slot direction conversion) lives in [`src/cms/converters/contentstack-field-mapper.ts`](../src/cms/converters/contentstack-field-mapper.ts) and [`src/cms/model/slot-maps.ts`](../src/cms/model/slot-maps.ts) (`toTypeCode`, `toSlotName`, `SLOT_FIELD_TO_SAP_NAME`). Type guards for the various Contentstack field shapes are in [`src/cms/model/type-guards.ts`](../src/cms/model/type-guards.ts).

---

## Module composition and DI ordering

`ContentstackCmsFeatureModule` ([`src/contentstack-cms-feature.module.ts`](../src/contentstack-cms-feature.module.ts)) is the single entry point a Spartacus app imports. It:

- registers the connector config and binds the typed accessor: `{ provide: ContentstackConfig, useExisting: Config }` (so `ContentstackConfig` reads from Spartacus's merged global `Config`);
- **eagerly imports** `ContentstackCmsModule` (the CMS adapter override) and `ContentstackLivePreviewModule`.

Both imports must be **eager** — the adapter resolves the first page at bootstrap and the Live Preview decorator is consulted as components render — so the lazy `CmsConfig.featureModules` gate isn't used.

> [!WARNING]
> **Import order is load-bearing and failures are silent.** Import `ContentstackCmsFeatureModule` **after** the stock Spartacus feature/OCC modules (which include `CmsOccModule`). Imported too early, the OCC adapters win the DI race and pages keep rendering from SAP with no error logged. See [troubleshooting](troubleshooting.md).

---

## Access-control layer

When [content gating](access-control.md) is enabled, `ContentstackRestrictionsService` ([`src/cms/access/contentstack-restrictions.service.ts`](../src/cms/access/contentstack-restrictions.service.ts)) filters entries by the viewer's tokens (login state / SAP role groups, supplied via the `CONTENTSTACK_CURRENT_USER` injection token). With gating on, restricted content is filtered out of the SSR payload *before* it is written, and the SSR cache key is scoped per permission set.

---

## SmartEdit bypass

The connector never imports `SmartEditRootModule`. `smartEditBypassGuard` ([`src/guards/contentstack-smartedit-bypass.ts`](../src/guards/contentstack-smartedit-bypass.ts)) neutralizes inbound legacy SmartEdit preview params on a content route.

---

## Source map

| Area | Path |
|---|---|
| Feature module (entry point) | `src/contentstack-cms-feature.module.ts` |
| Config interface + defaults | `src/config/` |
| Delivery client | `src/client/contentstack-client.service.ts` |
| CMS override module | `src/cms/contentstack-cms.module.ts` |
| Adapters | `src/cms/adapters/` |
| Normalizers (page + component) | `src/cms/converters/` |
| Component normalizers | `src/cms/converters/components/` |
| Model / type guards / slot maps | `src/cms/model/` |
| Access control | `src/cms/access/` |
| Live Preview / Visual Editor | `src/live-preview/` |
| SmartEdit bypass guard | `src/guards/` |
| Example component | `src/examples/hero-banner/` |
| Public API barrel | `src/public-api.ts` |

---

## Related

- [api-reference](api-reference.md) — the exported symbols in `src/public-api.ts`
- [concepts](concepts.md) — why the override works and why ordering matters
- [content-model](content-model.md) — the schema the normalizers consume
