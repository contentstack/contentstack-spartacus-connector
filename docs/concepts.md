---
title: "Concepts"
product: spartacus-connector
type: concepts
tags: [spartacus-connector, concepts]
last_updated: "2026-09-21"
---

# Concepts

The mental model behind the connector, in brief. Read this before [architecture](architecture.md) or [content-model](content-model.md); see the [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) document for the full design rationale.

At its core, the connector answers one question at every render: **does Contentstack have content for this slot? If so, use it — otherwise let SAP OCC fill it.** The four ideas below are the consequences of that rule that you actually have to internalize to install, configure, and author:

1. **Hybrid by default** — OCC is the base page; Contentstack overrides only what you author.
2. **The slot is the unit of control** — you author into named template positions, not free-form pages.
3. **Last provider wins** — the connector must be imported *after* the base Spartacus modules, or it silently does nothing.
4. **Two tokens, two audiences** — a read-only delivery token ships to the browser; the privileged import credential never leaves your dev machine.

---

## Hybrid rendering: OCC base, Contentstack islands

In **hybrid** mode (`occFallback: true`, the default) SAP OCC is the base for every page — shell, functional pages, and any unauthored slot render from SAP — and Contentstack overrides only the slots you author. For a given route the page adapter loads the OCC page structure *and* queries Contentstack, then merges them slot-by-slot: a slot authored in Contentstack replaces the OCC slot of the same SAP position; an empty slot keeps its OCC components. Commerce data always hydrates live from SAP.

> [!NOTE]
> The alternative is **full-replacement** mode (`occFallback: false`), where an unauthored page/slot is *not* backfilled from OCC — a route absent from Contentstack renders as not-found. Hybrid is the recommended default.

A useful sanity check: on an authored page, DevTools → Network shows **both** `cdn.contentstack.io` and `/occ/v2/...`. Seeing only OCC traffic means the override never engaged — see [DI ordering: last provider wins (and fails silently)](#di-ordering-last-provider-wins-and-fails-silently). See the [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) document for the merge-precedence rationale.

---

## The slot is the unit of control

**Slot names are not arbitrary** — they are Spartacus's template **positions**, defined by the storefront's `LayoutConfig`. A slot only renders if its template declares it.

- You author a **lowercase `snake_case` field** in Contentstack (e.g. `section1`).
- The connector maps it to the **PascalCase SAP position** (e.g. `Section1`) via `SLOT_FIELD_TO_SAP_NAME` in [`src/cms/model/slot-maps.ts`](../src/cms/model/slot-maps.ts).

See the [Slot reference](content-model.md#slot-reference) for the full table.

### Why the case mismatch exists

Contentstack enforces lowercase `snake_case` uids (`^[a-z][a-z0-9_]*$`); SAP keys slots and components by `PascalCase` (`Section2A`, `SimpleResponsiveBannerComponent`). Two pure functions in `slot-maps.ts` convert back at render time, both with an **identity fallback** so an unmapped name passes through unchanged:

- `toSlotName('section2_a')` → `'Section2A'`
- `toTypeCode('simple_responsive_banner_component')` → `'SimpleResponsiveBannerComponent'`

| Contentstack field uid | SAP position |
|---|---|
| `section1` | `Section1` |
| `section2_a` | `Section2A` |
| `placeholder_content_slot` | `PlaceholderContentSlot` |
| `navigation_bar` | `NavigationBar` |
| `footer` | `Footer` |

### Author only into positions the template renders

A component appears **only if** the SAP page template renders its slot. `LandingPage2Template` renders `Section1`, `Section2A/2B/2C`, and `Section3`–`Section5`, where `Section2A/2B/2C` are narrow one-third-width columns. There is **no bare `Section2`** slot in this template (that name belongs to `CategoryPageTemplate`) — the `landing_page` content type carries a `section2` field, but it has no rendering position here, so content authored into it never appears. Full-width content belongs in `Section1` or `Section3`–`Section5`. To discover the exact positions a page exposes, inspect the live OCC page for `<cx-page-slot position="…">`, or read `contentSlot.position` from `GET /occ/v2/<site>/cms/pages`.

### Adding a slot beyond the shipped set

There is no connector-side cap on slots. To add one, three small additions line up (see [content-model › Custom slots](content-model.md#custom-slots-unlimited)):

1. **Storefront** — declare `<cx-page-slot position="MyPromoStrip">` and its `LayoutConfig` entry.
2. **Connector config** — `additionalSlotFields: { my_promo_strip: 'MyPromoStrip' }` (merged over the built-in map by `effectiveSlotMap()`; custom entries win on key collisions).
3. **Content type** — add a `my_promo_strip` reference field to the page content type.

---

## Content types map to SAP typecodes

Each Contentstack **content type uid** maps to a SAP **typeCode** (e.g. `simple_responsive_banner_component` → `SimpleResponsiveBannerComponent`) via `TYPECODE_MAP` / `toTypeCode` in [`slot-maps.ts`](../src/cms/model/slot-maps.ts). The normalizer emits that typeCode and Spartacus's `CmsConfig.cmsComponents` map resolves it to an Angular component.

- Editorial starter-pack types map to **stock** Spartacus components automatically — no `cmsComponents` config needed.
- Add a `cmsComponents` entry only for **your own** components. The map key **must equal** the emitted typeCode exactly (a custom content type not in the map falls back to its raw uid).

Two special cases the source encodes:

- **Flex components.** For a `CMSFlexComponent`, Spartacus selects the Angular component by the authored `flex_type`, not the typeCode. `resolveFlexType()` returns `flex_type` for `CMSFlexComponent` and the plain typeCode for everything else.
- **`componentTypeMapping` is reserved.** It is declared on `ContentstackConfig` (block uid → SAP typeCode) but the connector does **not** read it today — typecodes resolve via `TYPECODE_MAP` / `toTypeCode`. Treat it as reserved config.

---

## References, not Modular Blocks

Slots are **multi-reference fields**; the connector resolves the referenced component entries inline via the Delivery SDK's `includeReference`. Contentstack **Modular Blocks** (inline composed blocks) are **not** read — model each component as its own content type referenced from the page or shell.

The `includeReferences` config controls which reference fields are expanded. The default (`PAGE_REFERENCE_FIELDS` in `slot-maps.ts`) already expands `<slot>.media_container` for every standard slot, so a banner placed directly in a standard slot resolves its image set out of the box. Only a `media_container` nested deeper than the default expects needs its full path added explicitly — see [Media Container](content-model.md#media-container-resolving-a-nested-reference).

### Why references and not Modular Blocks

Two reasons: **reuse** (a component authored as its own entry can be referenced from many pages and edited once; modular blocks are inline to a single entry) and **the normalizer reads references** (it walks each slot's resolved reference entries and does not descend into modular-block structures, so content modeled that way is invisible to the pipeline). The full rationale — including why the flat navigation model exists to dodge the plan-gated reference-depth cap — is in the [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) document.

---

## Page-type resolution

- **Per-route content/landing pages** (including the homepage) resolve against a single `cmsPageContentType`, queried by slug. The starter pack authors the home as `landing_page`; the connector resolves the homepage route to the slug `/`, so the home entry's slug field must be exactly `/`.
- **Shared-layout pages** (product detail, category/list) use `pageTypeMapping` to point a `PageType` at its own `contentTypeUid` and a fixed `sharedSlug` — one shared entry serves every PDP/PLP, and product/facet data always come from OCC. Because these are never route-derived, `slugTransform` does not apply to them.
- **Unmapped page types fall back to OCC.** Serving multiple *distinct per-route* content types beyond the single `cmsPageContentType` is not supported yet.

When OCC's route and the CMS slug don't match byte-for-byte (locale/category prefixes, etc.), use `slugTransform` to rewrite the route before querying rather than reauthoring entries. See [troubleshooting](troubleshooting.md#the-homepage-or-a-specific-page-never-resolves).

---

## The two-token security model

| Token | Used where | Nature |
|---|---|---|
| **Delivery token** (+ API key) | The storefront, at runtime | Read-only; safe in the client bundle. |
| **`csdx auth:login`** (or a scoped management token) | Your dev machine, one-time content-model import | Privileged; never committed, never shipped. |
| **Preview token** | Non-production Live Preview builds only | **Secret** — grants read access to unpublished drafts; keep out of committed source. |

The storefront only ever uses the read-only delivery token; the privileged credential exists solely for the one-time starter-pack import (`csdx cm:stacks:import`). The `previewToken` is emitted by `ng add` only when you enable Live Preview, and the connector **refuses to activate Live Preview in production mode**, so a stray preview build can't leak drafts to end users. See [Provision the content model](installation.md#step-2-provision-the-content-model-demo-seed-csdx).

---

## DI ordering: last provider wins (and fails silently)

The connector overrides Spartacus's abstract `CmsPageAdapter` / `CmsComponentAdapter` tokens and relies on Angular DI's **last-provider-wins** rule. `ContentstackCmsFeatureModule` must be imported **after** the base Spartacus modules (which include `CmsOccModule`).

> [!WARNING]
> If the feature module is imported *before* the base modules — or omitted — the OCC adapters win the DI race, pages keep rendering from SAP OCC, and **no error is thrown**. The integration simply does nothing. If content isn't coming from Contentstack, check import ordering first. See [Module composition and DI ordering](architecture.md#module-composition-and-di-ordering) and [troubleshooting](troubleshooting.md).

In a standard `ng add @spartacus/schematics` app, the safe place is **last** in `SpartacusFeaturesModule` (or after `StorefrontModule`):

```ts
@NgModule({
  imports: [
    // ...existing Spartacus feature/OCC modules stay as-is...
    ContentstackCmsFeatureModule, // <-- add last
  ],
})
export class SpartacusFeaturesModule {}
```

The `ng add` schematic places the import for you; the ordering rule only bites when wiring the module by hand.

---

## Eager, not lazy

`ContentstackCmsFeatureModule` **eagerly** imports the CMS adapter override and Live Preview modules — the adapter must resolve the very first page at bootstrap, and the Live Preview decorator is consulted as components render. The standard lazy `CmsConfig.featureModules` gate is deliberately not used (it only fires for a feature-tagged `cmsComponents` entry, which this library never registers — so an earlier lazy version silently never activated).

The module also registers `defaultContentstackConfig` as default config, binds `ContentstackConfig` to Spartacus's merged `Config`, and provides a **core-only** `CONTENTSTACK_CURRENT_USER` (login state only, via `@spartacus/core`'s `AuthService`); role-level gating requires the app to override that token with the real user from `@spartacus/user`. It deliberately does **not** import `SmartEditRootModule` and registers **no** `cmsComponents` mappings. See the [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) document for why this composition is shaped this way.

---

## Related

- [architecture](architecture.md) — the concrete override chain and normalizer pipeline
- [content-model](content-model.md) — slots, content types, and the seed
- [configuration](configuration.md) — every knob these concepts expose
- [Solution Architecture](https://docs.google.com/document/d/14SpcA3-QANEtHt_T8LLp880EqWg6lz3b/edit) — the full design rationale
