---
title: "SAP Spartacus Connector Wiki Schema"
product: spartacus-connector
type: schema
tags: [schema, meta]
last_updated: "2026-09-09"
---

# SAP Spartacus Connector Wiki Schema

This file defines the structural rules for the SAP Spartacus Connector documentation. **Read this file before making any edits to `docs/`.**

These docs follow the [Contentstack product-wiki](https://github.com/contentstack/product-wiki) conventions (YAML frontmatter, relative Markdown link navigation, callouts) so the docs team can review them and, if desired, lift them into the central wiki as a `spartacus-connector` product directory.

---

## Required Top-Level Files

| File | Type | Purpose |
|---|---|---|
| `index.md` | `index` | Table of contents — always updated when files are added/removed |
| `schema.md` | `schema` | This file — org rules, naming conventions, structure |
| `overview.md` | `overview` | What the connector is, what it does, current status |

---

## Naming Conventions

- Filenames: **lowercase, hyphen-separated** (e.g. `content-model.md`, `api-reference.md`).
- No spaces, no underscores, no camelCase in filenames.
- Descriptive names that reflect content, not document type.

---

## Frontmatter Requirements

Every file must include valid YAML frontmatter:

```yaml
---
title: "<Human-readable title>"
product: spartacus-connector
type: "<overview | architecture | concepts | api | reference | status | schema | index | troubleshooting>"
tags: [spartacus-connector, <topic-tags>]
last_updated: "<YYYY-MM-DD>"
---
```

Update `last_updated` whenever a file is modified.

---

## Internal Links

Use standard relative Markdown links for internal navigation so they render everywhere (GitHub, VS Code, and other Markdown viewers):

- `[Overview](overview.md)` — link to a file in this directory.
- `[Status](overview.md#status)` — link to a section.

Link out to the repository's source-of-truth Markdown (`README.md`, `GETTING_STARTED.md`, `CONTENT-MODEL.md`, `TROUBLESHOOTING.md`) and to `src/` files with relative Markdown links.

> [!NOTE]
> The central product-wiki is an Obsidian vault that prefers `[[wikilink]]` syntax. If these docs are later promoted into that wiki, convert the relative Markdown links to wikilinks at that point.

---

## Category Map (what each page holds)

| Page | Holds |
|---|---|
| `overview.md` | Elevator pitch, what it does / doesn't do, supported features + limitations, status |
| `concepts.md` | The mental model — hybrid rendering, slots/islands, the two-token security model, page-type resolution |
| `architecture.md` | The adapter-override chain, normalizer pipeline, DI ordering, module composition |
| `installation.md` | End-to-end install & wiring walkthrough (mirrors `GETTING_STARTED.md`) |
| `configuration.md` | Full `ContentstackConfig` reference |
| `content-model.md` | Content types, slot map, seed guidance (mirrors `CONTENT-MODEL.md`) |
| `live-preview.md` | Live Preview / Visual Builder bindings |
| `access-control.md` | Presentation-level content gating |
| `api-reference.md` | Public API surface — modules, services, adapters, normalizers, directives, tokens |
| `troubleshooting.md` | Common integration issues (mirrors `TROUBLESHOOTING.md`) |

---

## File vs. Subdirectory Rule

Use a **flat file** for a single-topic page. Create a **subdirectory** (with its own `index.md`) only when a topic grows to 3+ related pages. Do not place new files at the root as a fallback — the root is reserved for the spine docs named above.

---

## Source of Truth

The connector's `src/` and its root Markdown docs are the ground truth. When code and these docs disagree, the code wins — update the doc and its `last_updated`. Do not document behavior that isn't in the shipped source.
