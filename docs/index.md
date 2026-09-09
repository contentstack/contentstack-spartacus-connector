---
title: "SAP Spartacus Connector"
product: spartacus-connector
type: index
tags: [index, spartacus-connector]
last_updated: "2026-09-09"
---

# SAP Spartacus Connector

`@contentstack/contentstack-spartacus-connector` — an open-source Angular feature library that makes **Contentstack** the CMS engine for an **SAP Composable Storefront (Spartacus)**, while **SAP Commerce (OCC)** stays the commerce engine. It overrides Spartacus's CMS adapter layer so page and component content resolve from Contentstack's Content Delivery API instead of OCC, while product/cart/checkout data still hydrates live from SAP.

> [!INFO]
> These docs follow the [Contentstack product-wiki](https://github.com/contentstack/product-wiki) conventions so the docs team can review them and, if useful, promote them into the central wiki. Read [schema](schema.md) before editing. The repository's root Markdown files (`README.md`, `GETTING_STARTED.md`, `CONTENT-MODEL.md`, `TROUBLESHOOTING.md`) remain the source of truth; these pages organize and expand on them.

---

## Pages in This Section

| File | Description |
|---|---|
| [Overview](overview.md) | What the connector is, what it does and doesn't do, supported features, known limitations, and status |
| [Concepts](concepts.md) | The mental model — hybrid rendering, slots as the unit of control, editable islands, the two-token security model |
| [Architecture](architecture.md) | The CMS adapter-override chain, the normalizer pipeline, DI ordering, and module composition |
| [Installation](installation.md) | End-to-end install & wiring walkthrough (content model import, module wiring, verification) |
| [Configuration](configuration.md) | The complete `ContentstackConfig` reference |
| [Content Model](content-model.md) | Page and component content types, the slot map, custom slots, and seed guidance |
| [Live Preview](live-preview.md) | Live Preview / Visual Builder bindings and directives |
| [Access Control](access-control.md) | Presentation-level, opt-in content gating |
| [API Reference](api-reference.md) | The public API surface — modules, services, adapters, normalizers, directives, tokens |
| [Troubleshooting](troubleshooting.md) | Common integration issues and their fixes |

---

## Quick Start

1. Read [overview](overview.md) and [concepts](concepts.md) to understand the hybrid model.
2. Follow [installation](installation.md) to import the content model and wire the module into a real Spartacus app.
3. Reference [configuration](configuration.md) and [content-model](content-model.md) while authoring.
4. When something doesn't render, jump to [troubleshooting](troubleshooting.md).

---

## Status

`0.1.0` — framework core validated end-to-end against a real Spartacus app + SAP OCC + Contentstack, plus Live Preview / Visual Editor bindings and the `ng add` schematic installer. The content model starter pack, a reference storefront, and B2B support are tracked as separate deliverables. See [Status](overview.md#status).
