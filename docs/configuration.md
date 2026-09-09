---
title: "Configuration"
product: spartacus-connector
type: reference
tags: [spartacus-connector, configuration, reference]
last_updated: "2026-09-09"
---

# Configuration

Every option lives on the `ContentstackConfig` interface ([`src/config/contentstack-config.ts`](../src/config/contentstack-config.ts)) and is **fully typed** — because the library augments Spartacus's `Config`, your editor autocompletes and type-checks the whole `provideConfig(<ContentstackConfig>{ contentstack: … })` block, with each field's JSDoc on hover.

```ts
provideConfig(<ContentstackConfig>{
  contentstack: {
    delivery: { /* connection & credentials */ },
    /* behavior options */
    accessControl: { /* opt-in content gating */ },
  },
})
```

---

## `contentstack.delivery` — connection & credentials

| Option | Required | Default |
|---|---|---|
| `apiKey` | yes | — |
| `deliveryToken` | yes | — |
| `environment` | yes | — |
| `region` | | `Region.US` |
| `branch` | | `main` |
| `livePreview` | | `false` |
| `previewToken` | when `livePreview` | — |
| `previewHost` | | US preview host |

Where to get the credentials:

| Value | Where |
|---|---|
| `apiKey` | Settings → Stack settings → **API Key** |
| `deliveryToken` | Settings → Tokens → **Delivery Tokens** (scope it to your environment) |
| `environment` | your publishing environment, e.g. `development` |
| `region` | your stack's data center (`Region.US` / `EU` / `AZURE_NA` / …) |

> [!INFO]
> **Secret hygiene.** `apiKey` + `deliveryToken` are read-only and safe in the client bundle. A `previewToken` (Live Preview only) is a **secret** — keep it out of committed source; `.env*` is gitignored, and you can gitignore the real credentials file or swap it per build via Angular `fileReplacements`.

---

## `contentstack` — behavior

| Option | Default / note |
|---|---|
| `cmsPageContentType` | Page content type queried by slug (the starter pack uses `landing_page`). |
| `slugField` | `url` — field holding the page slug. |
| `slugTransform` | `{ pattern, replacement }` regex rewrite of the route slug before querying. |
| `localeMapping` | Site isocode → Contentstack locale (e.g. `{ en: 'en-us' }`); identity fallback. |
| `includeFallback` | `false` — request master-locale fallback for unlocalized entries. |
| `occFallback` | `true` — hybrid (OCC base + CS overrides); `false` = full-replacement. |
| `globalSlots` | `{ contentType, title? }` — shared shell merged into every page. |
| `pageTypeMapping` | Per-`PageType` `{ contentTypeUid, slugField?, sharedSlug? }` (shared-layout pages). |
| `additionalSlotFields` | Extra `{ fieldUid: 'SapSlotPosition' }` beyond the built-in slot map. |
| `componentContentType` | Content type for standalone component lookups (else components ship in pages). |
| `componentTypeMapping` | Block uid → SAP typeCode (for author-named blocks without a `type_code`). |
| `includeReferences` | Reference fields to expand; defaults to all slot + header/footer fields. |
| `accessControl` | Presentation-level gating — see below and [access-control](access-control.md). |
| `timeoutMs` | `10000` — Delivery API call timeout. |

### Notes on selected options

- **`occFallback`** — the switch between [hybrid](concepts.md#hybrid-rendering-occ-base-contentstack-islands) (`true`, default) and full-replacement (`false`). Leave it on unless you truly author every page.
- **`slugTransform`** — use it when OCC's route and the CMS-authored slug don't match byte-for-byte (locale/category prefixes). Rewrites the route before the query rather than reauthoring entries. See its JSDoc and [troubleshooting](troubleshooting.md).
- **`pageTypeMapping`** — points a `PageType` (e.g. product, category) at its own content type + `sharedSlug`. One shared entry serves every PDP/PLP. See [Page-type resolution](concepts.md#page-type-resolution).
- **`includeReferences`** — defaults to all page slot + header/footer fields. Add nested paths (e.g. `section1.media_container`) when a component references another content type. See [Media Container](content-model.md#media-container-resolving-a-nested-reference).
- **`localeMapping` / `includeFallback`** — see [content-model](content-model.md) and [Step 4 — Configure](installation.md#step-4-configure).

---

## `contentstack.accessControl` — opt-in content gating

| Option | Default |
|---|---|
| `enabled` | `false` |
| `accessField` | `access_tags` |
| `anonymousToken` | `_require-anonymous` |
| `loginToken` | `_require-login` |
| `rolePrefix` | `_require-` (role `b2badmingroup` → `_require-b2badmingroup`) |
| `gateSharedSlugPages` | `false` |

Full behavior, the `CONTENTSTACK_CURRENT_USER` wiring for role-level gating, and the SSR-caching caveats are in [access-control](access-control.md).

---

## Defaults

The shipped defaults live in [`src/config/default-contentstack-config.ts`](../src/config/default-contentstack-config.ts) (exported as part of the public API, e.g. `defaultContentstackConfig`). Spread them when extending array options so you don't drop the built-ins:

```ts
includeReferences: [
  ...defaultContentstackConfig.contentstack.includeReferences!,
  'section1.media_container',
]
```

---

## Related

- [Step 4 — Configure](installation.md#step-4-configure) — the minimal working config
- [content-model](content-model.md) — the content the config points at
- [live-preview](live-preview.md) — enabling `livePreview` + `previewToken`
- [access-control](access-control.md) — the full gating story
