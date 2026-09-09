---
title: "Installation"
product: spartacus-connector
type: reference
tags: [spartacus-connector, installation, getting-started]
last_updated: "2026-09-09"
---

# Installation

Wire the connector into a **real, normally-scaffolded** Spartacus app (created via `ng add @spartacus/schematics`). This mirrors the repository's [`GETTING_STARTED.md`](../GETTING_STARTED.md); read [concepts](concepts.md) first for the hybrid model.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| A working Spartacus app | Composable Storefront `2211.x`+ (Angular 21+). |
| A Contentstack stack | A read-only **delivery token** + **API key** for the storefront, and a **preview token** if you use Live Preview. Provisioning the content model uses `csdx auth:login` — no management token in the app. |
| A reachable SAP OCC backend | Your storefront already has one; the connector doesn't change how Spartacus talks to SAP for commerce. |

> [!NOTE]
> Public npm's `@spartacus/*` packages cap out around `4.3.8` (Angular 12). The current Angular-21-era Composable Storefront is distributed **only** via SAP's private RBSC registry (requires an SAP Universal ID). See [troubleshooting](troubleshooting.md).

---

## Step 1 — Install

```bash
npm install @contentstack/contentstack-spartacus-connector @contentstack/delivery-sdk
```

---

## Step 2 — Provision the content model + demo seed (csdx)

Create an **empty stack** whose master locale is **English – United States (`en-us`)**, then import the **Content Model Starter Pack** (`import-export/starter-pack/`):

```bash
npm install -g @contentstack/cli
csdx config:set:region <NA | EU | AZURE-NA | ...>
csdx auth:login                                  # provisioning — dev machine only
csdx cm:stacks:import --stack-api-key <STACK_API_KEY> \
  --data-dir ./node_modules/@contentstack/contentstack-spartacus-connector/import-export/starter-pack \
  --yes
```

This imports the content types, locales, and seed entries and creates a **`development`** environment. Then, in the Contentstack UI, **publish** the seed entries to `development` and create a **delivery token** for that environment (the only Contentstack credential the storefront needs).

> [!INFO]
> **Two-token model:** the storefront only ever uses a read-only **delivery token**. The privileged credential (`csdx auth:login`, or a scoped/expiring management token) is for the one-time import on your machine — never commit it, never ship it. See [The two-token security model](concepts.md#the-two-token-security-model).

---

## Step 3 — Wire the module

### Option A (recommended) — `ng add`

```bash
ng add @contentstack/contentstack-spartacus-connector
```

One interactive command generates an app-side `ContentstackFeatureModule` (with your `provideConfig(<ContentstackConfig>{…})`) and adds it to your `SpartacusFeaturesModule`. It prompts for region, Live Preview (y/n), fallback options, and credentials (blank answers scaffold `<PLACEHOLDER>`s to fill later).

Pass answers as **kebab-case** flags for non-interactive/CI installs:

```bash
ng add @contentstack/contentstack-spartacus-connector \
  --api-key=… --delivery-token=… --environment=development \
  --region=US --interactive=false
```

Delivery credentials are written to **`src/environments/contentstack.environment.ts`** (referenced from the generated module), not inlined in the NgModule — so they stay out of the committed module and can be swapped per environment via Angular's `fileReplacements`.

> [!WARNING]
> **Preview token is a secret.** A `previewToken` is emitted **only when you enable Live Preview**, and it grants read access to *unpublished* draft content. Use it only in a non-production build and do **not** commit a real value. The connector also refuses to activate Live Preview when the app runs in production mode.

### Option B — manual

In `spartacus-features.module.ts`, import the feature module **after** the stock Spartacus feature/OCC modules:

```ts
import { ContentstackCmsFeatureModule } from '@contentstack/contentstack-spartacus-connector';

@NgModule({
  imports: [
    // ...existing Spartacus feature/OCC modules stay as-is...
    ContentstackCmsFeatureModule, // <-- add last
  ],
})
export class SpartacusFeaturesModule {}
```

> [!WARNING]
> **Ordering matters — and failures are silent.** If `ContentstackCmsFeatureModule` is imported *before* the stock Spartacus modules (or omitted), the OCC adapters win the DI race, pages keep rendering straight from SAP OCC, and **no error is thrown**. If content isn't coming from Contentstack, check this ordering first.

---

## Step 4 — Configure

In `spartacus-configuration.module.ts`:

```ts
import { ContentstackConfig } from '@contentstack/contentstack-spartacus-connector';
import { provideConfig } from '@spartacus/core';

provideConfig(<ContentstackConfig>{
  contentstack: {
    delivery: {
      apiKey: '<STACK_API_KEY>',
      deliveryToken: '<DELIVERY_TOKEN>',   // read-only, safe in the client bundle
      environment: '<ENVIRONMENT>',        // e.g. development
      // Live Preview / Visual Builder (optional). NON-PRODUCTION builds only.
      livePreview: true,
      previewToken: '<PREVIEW_TOKEN>',
    },
    // Page content type resolved for content/landing routes (incl. the homepage).
    cmsPageContentType: 'landing_page',
    // Map site language isocodes -> Contentstack locale codes (only where they differ).
    localeMapping: { en: 'en-us', de: 'de-de', ja: 'ja-jp', zh: 'zh-cn' },
    // occFallback defaults to true (hybrid). Set false only for full-replacement mode.
  },
}),
```

Notes:
- **`occFallback`** is `true` by default — that's what makes the shell/commerce pages render from OCC. Leave it on.
- **Multi-language:** with locales that have a `fallback_locale`, unlocalized content inherits the master locale automatically. `includeFallback: true` adds the delivery-query fallback for edge cases.
- **`region`** — set on `delivery` to match your stack's data center.

See [configuration](configuration.md) for the full option set.

---

## Step 5 — (Only for custom components) map content types to Angular components

The editorial starter-pack types (banner, carousel, paragraph, link, …) map to **stock** Spartacus components automatically via their SAP typecodes — no config needed. You only add a `cmsComponents` mapping for your **own** components; follow [`src/examples/hero-banner/custom-hero.module.ts`](../src/examples/hero-banner/custom-hero.module.ts).

The `cmsComponents` map key **must equal** the SAP typecode the normalizer emits (see [Field naming and SAP mapping](content-model.md#field-naming-and-sap-mapping)).

---

## Step 6 — Run and verify

```bash
ng serve   # or your SSR command
```

Expect:
1. The full **SAP shell** (header, nav, footer) + functional pages render from OCC — the store works end-to-end.
2. Slots you authored in Contentstack (e.g. the home hero/carousel) render as **islands** over that base. DevTools → Network shows **both** `cdn.contentstack.io` (content) **and** `/occ/v2/...` (base + commerce) — that's hybrid working.
3. Switching site language reloads the Contentstack content in the matching locale (or falls back to master where unlocalized).

---

## Verification (in-repo)

This library targets `@spartacus/*` public contracts; a full end-to-end run requires a live SAP OCC backend + a Contentstack stack. Offline gates:

| Command | What it proves |
|---|---|
| `npm run typecheck` | Adapters, normalizers, LP/VE services, and the schematic conform to the real Spartacus contract shapes. Resolves `@angular/*`/`rxjs`/`@ngrx/store` from `node_modules` and `@spartacus/*` from `typings/`. |
| `npm test` | Pure-logic Contentstack→Spartacus transforms (page + component normalizers, the three component-specific normalizers, and type guards) via lightweight stubs. |
| `npm run test:schematics` | The `ng add` schematic via the real `SchematicTestRunner` against a test-only `@spartacus/schematics` stub. Verifies `collection.json`/`schema.json` wiring. |
| `npm run test:all` | Both test suites. |

> [!NOTE]
> `typings/` shims exist only for the offline typecheck; they are unused once the real `@spartacus/*` / `@contentstack/delivery-sdk` packages are installed.

---

## Where to go next

- Content model + slot reference → [content-model](content-model.md)
- The starter pack (import) → [`import-export/starter-pack/README.md`](../import-export/starter-pack/README.md)
- Full config reference → [configuration](configuration.md)
- Not rendering / errors → [troubleshooting](troubleshooting.md)
