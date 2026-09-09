---
title: "API Reference"
product: spartacus-connector
type: api
tags: [spartacus-connector, api, reference]
last_updated: "2026-09-09"
---

# API Reference

The public API surface, as exported from [`src/public-api.ts`](../src/public-api.ts). A Spartacus app typically only needs **`ContentstackCmsFeatureModule`** plus the **`ContentstackConfig`** type; the rest is provided for advanced customization (custom adapters, normalizers, or reusing the client service in bespoke components).

---

## Entry point

| Export | From | Purpose |
|---|---|---|
| `ContentstackCmsFeatureModule` | `contentstack-cms-feature.module` | **The single module a Spartacus app imports.** Registers config, binds `ContentstackConfig` to Spartacus's `Config`, and eagerly imports the CMS override + Live Preview modules. Import it **after** the base Spartacus modules. |

---

## Configuration

| Export | From | Purpose |
|---|---|---|
| `ContentstackConfig` | `config/contentstack-config` | The fully-typed config interface (augments Spartacus's `Config`). See [configuration](configuration.md). |
| `defaultContentstackConfig` | `config/default-contentstack-config` | Shipped defaults — spread when extending array options like `includeReferences`. |

---

## Client

| Export | From | Purpose |
|---|---|---|
| `ContentstackClientService` | `client/contentstack-client.service` | Wraps `@contentstack/delivery-sdk`; queries entries by slug and expands configured reference fields. Reuse it in custom components that need raw Contentstack reads. |

---

## CMS override layer

| Export | From | Purpose |
|---|---|---|
| `ContentstackCmsModule` | `cms/contentstack-cms.module` | The adapter-override module (imported eagerly by the feature module). |
| `ContentstackCmsPageAdapter` | `cms/adapters/contentstack-cms-page.adapter` | Replaces the OCC `CmsPageAdapter`; resolves a page by slug. |
| `ContentstackCmsComponentAdapter` | `cms/adapters/contentstack-cms-component.adapter` | Replaces the OCC `CmsComponentAdapter`; standalone/shared component lookups. |
| `ContentstackCmsPageNormalizer` | `cms/converters/contentstack-cms-page.normalizer` | Contentstack page entry → Spartacus `CmsStructureModel`. |
| `ContentstackCmsComponentNormalizer` | `cms/converters/contentstack-cms-component.normalizer` | Dispatches a component to its type-specific normalizer by typecode. |
| `ContentstackFieldMapper` | `cms/converters/contentstack-field-mapper` | Shared field/uid ↔ typecode/slot mapping helpers. |

### Component normalizers

| Export | From |
|---|---|
| Banner normalizer | `cms/converters/components/contentstack-cms-banner-component.normalizer` |
| Navigation normalizer | `cms/converters/components/contentstack-cms-navigation-component.normalizer` |
| Product carousel normalizer | `cms/converters/components/contentstack-cms-product-carousel-component.normalizer` |

### Model & mapping

| Export | From | Purpose |
|---|---|---|
| Model types | `cms/model/contentstack.model` | Contentstack payload/entry shapes the normalizers consume. |
| Type guards | `cms/model/type-guards` | Runtime shape checks (e.g. `isMediaContainer()`). |
| Slot maps | `cms/model/slot-maps` | `SLOT_FIELD_TO_SAP_NAME`, `toTypeCode`, `toSlotName`. |

---

## Access control

| Export | From | Purpose |
|---|---|---|
| `CONTENTSTACK_CURRENT_USER` | `cms/access/contentstack-current-user` | Injection token the app provides to feed the logged-in user (role-level gating). See [Role-level gating](access-control.md#role-level-gating). |
| `ContentstackRestrictionsService` | `cms/access/contentstack-restrictions.service` | Filters entries by the viewer's tokens; scopes SSR caching per permission set. |

---

## SmartEdit bypass

| Export | From | Purpose |
|---|---|---|
| `smartEditBypassGuard` | `guards/contentstack-smartedit-bypass` | Route guard that strips legacy SmartEdit preview params. |

---

## Live Preview / Visual Editor

| Export | From | Purpose |
|---|---|---|
| `ContentstackLivePreviewModule` | `live-preview/contentstack-live-preview.module` | Live Preview module (imported eagerly by the feature module). |
| `ContentstackAngularService` | `live-preview/contentstack-angular.service` | Bridges the Live Preview runtime to Angular change detection. |
| `ContentstackLivePreviewService` | `live-preview/contentstack-live-preview.service` | Sets up the SDK and drives live content refreshes. |
| `@ContentstackComponent` | `live-preview/contentstack-component.decorator` | Marks a component for Live Preview entry/field tagging. |
| `CsEditableDirective` | `live-preview/cs-editable.directive` | `csEditable` — per-field edit tags. |
| `CsEmptyBlockParentDirective` | `live-preview/cs-empty-block-parent.directive` | Empty-slot affordance for the Visual Builder. |

See [live-preview](live-preview.md) for usage.

---

## Example component (illustrative)

The `hero-banner` exports demonstrate live SAP hydration (reading a SKU from Contentstack, pulling price/stock via `ProductService` / `ActiveCartFacade`). Real components live in the consuming app — copy the pattern, don't depend on these directly.

| Export | From |
|---|---|
| Hero model | `examples/hero-banner/hero.model` |
| `CustomHeroComponent` | `examples/hero-banner/custom-hero.component` |
| `CustomHeroModule` | `examples/hero-banner/custom-hero.module` |

---

## Related

- [architecture](architecture.md) — how these symbols compose at runtime
- [configuration](configuration.md) — the `ContentstackConfig` fields
- [installation](installation.md) — importing `ContentstackCmsFeatureModule`
