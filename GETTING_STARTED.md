# Getting Started

Wire this connector into a **real, normally-scaffolded** Spartacus app (created via
`ng add @spartacus/schematics`).

## How it works (read this first)

The connector runs in **hybrid** mode: **SAP Commerce (OCC) is the base for every page**, and
Contentstack **overrides only the slots you author**. Anything not in Contentstack — the shell,
navigation, footer, and functional pages (login, cart, checkout, order, track) — renders from
SAP, exactly as it does today. So you get a fully working storefront and manage just the
marketing content headlessly. Content lives in Contentstack; **commerce (products, cart,
checkout, users) stays in SAP** and hydrates live.

## Prerequisites

| Requirement | Notes |
| --- | --- |
| A working Spartacus app | Composable Storefront `2211.x`+ (Angular 21+). |
| A Contentstack stack | You'll need a read-only **delivery token** + **API key** for the storefront, and a **preview token** if you use Live Preview. Provisioning the content model uses `csdx auth:login` (below) — no management token in the app. |
| A reachable SAP OCC backend | Your storefront already has one; the connector doesn't change how Spartacus talks to SAP for commerce. |

## Step 1 — Install

```bash
npm install @contentstack/contentstack-spartacus-connector @contentstack/delivery-sdk
```

## Step 2 — Provision the content model + demo seed (csdx)

Create an **empty stack** whose master locale is **English - United States (`en-us`)**, then
use Contentstack's official CLI to import the **Content Model Starter Pack**
(`import-export/starter-pack/` — per-template content types + locales + a small demo seed):

```bash
npm install -g @contentstack/cli
csdx config:set:region <NA | EU | AZURE-NA | ...>
csdx auth:login                                  # provisioning — dev machine only
csdx cm:stacks:import --stack-api-key <STACK_API_KEY> \
  --data-dir ./node_modules/@contentstack/contentstack-spartacus-connector/import-export/starter-pack \
  --yes
```

This imports the content types, locales, and seed entries and creates a **`development`**
environment (no manual env setup needed). Then, in the Contentstack UI, **publish** the seed
entries to `development` and create a **delivery token** for that environment (the only
Contentstack credential the storefront needs).

> **Two-token model:** the storefront only ever uses a **read-only delivery token**. The
> privileged credential (`csdx auth:login`, or a scoped/expiring management token) is for the
> one-time import on your machine — never commit it, never ship it.

## Step 3 — Wire the module

### Option A (recommended) — `ng add`

One interactive command generates an app-side `ContentstackFeatureModule` (with your
`provideConfig(<ContentstackConfig>{…})`) and adds it to your `SpartacusFeaturesModule`:

```bash
ng add @contentstack/contentstack-spartacus-connector
```

It prompts for region (a pick-list), Live Preview (y/n), fallback options, and the
credentials (blank answers scaffold `<PLACEHOLDER>`s to fill later). Pass answers as flags for
non-interactive/CI installs — use **kebab-case** flags (the Angular CLI dasherizes
multi-word options), e.g. `--api-key=… --delivery-token=… --environment=development
--region=US --interactive=false`. (This wires **code/config** only — content still comes from
the csdx starter-pack import in Step 2.)

The delivery credentials are written to **`src/environments/contentstack.environment.ts`**
(referenced from the generated module), not inlined in the NgModule — so they stay out of the
committed module and can be swapped per environment via Angular's `fileReplacements`. Fill any
`<PLACEHOLDER>`s there.

> **Preview token is a secret.** A `previewToken` is emitted **only when you enable Live
> Preview**, and it grants read access to *unpublished* draft content. Use it only in a
> non-production build and do **not** commit a real value (git-ignore the env file if it holds
> one). The connector also refuses to activate Live Preview when the app runs in production mode,
> so a stray preview build can't leak drafts to end users.

### Option B — manual

In `spartacus-features.module.ts`, import our feature module **after** the stock Spartacus
feature/OCC modules (Angular DI is last-provider-wins, so import order is what lets our adapters
sit in front of the OCC ones):

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
      // Live Preview / Visual Builder (optional). NON-PRODUCTION builds only —
      // the previewToken grants read access to unpublished drafts (keep it out of
      // committed source), and the connector ignores Live Preview in production.
      livePreview: true,
      previewToken: '<PREVIEW_TOKEN>',
    },
    // Page content type resolved for content/landing routes (incl. the homepage).
    // The starter pack authors the home as a `landing_page`.
    cmsPageContentType: 'landing_page',
    // Map site language isocodes -> Contentstack locale codes (only where they differ).
    localeMapping: { en: 'en-us', de: 'de-de', ja: 'ja-jp', zh: 'zh-cn' },
    // occFallback defaults to true (hybrid). Set false only for full-replacement mode.
  },
}),
```

Notes:
- **`occFallback`** is `true` by default — that's what makes the shell/commerce pages render
  from OCC. Leave it on.
- **Multi-language**: with locales that have a `fallback_locale`, unlocalized content inherits
  the master locale automatically. `includeFallback: true` adds the delivery-query fallback for
  edge cases (optional).
- **`region`** — set on `delivery` to match your stack's data center.

## Step 5 — (Only for custom components) map content types to Angular components

The editorial starter-pack types (banner, carousel, paragraph, link, …) map to **stock**
Spartacus components automatically via their SAP typecodes — no config needed. You only add a
`cmsComponents` mapping for your **own** components; follow
`src/examples/hero-banner/custom-hero.module.ts`.

## Step 6 — Run and verify

```bash
ng serve   # or your SSR command
```

Expect:
1. The full **SAP shell** (header, nav, footer) + functional pages render from OCC — the store
   works end-to-end.
2. Slots you authored in Contentstack (e.g. the home hero/carousel) render as **islands** over
   that base. DevTools → Network shows **both** `cdn.contentstack.io` (content) **and**
   `/occ/v2/...` (base + commerce) — that's hybrid working.
3. Switching site language reloads the Contentstack content in the matching locale (or falls
   back to master where unlocalized).

## Where to go next
- Content model + slot reference → **`CONTENT-MODEL.md`**
- The starter pack (import) → **`import-export/starter-pack/README.md`**
- Not rendering / errors → **`TROUBLESHOOTING.md`**
