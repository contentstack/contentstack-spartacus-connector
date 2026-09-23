---
title: "Installation"
product: spartacus-connector
type: reference
tags: [spartacus-connector, installation, getting-started]
last_updated: "2026-09-22"
---

# Installation

Wire the connector into a **real, normally-scaffolded** Spartacus app. If you don't have one yet, **[Step 0](#step-0-create-the-spartacus-base-app)** takes you from an empty machine to a running SAP storefront first; if you already have a Composable Storefront app, skip to [Step 1](#step-1-install). This mirrors the repository's [`GETTING_STARTED.md`](../GETTING_STARTED.md); read [concepts](concepts.md) first for the hybrid model.

The connector runs in **hybrid** mode by default: **SAP Commerce (OCC) is the base for every page**, and Contentstack **overrides only the slots you author**. The shell (header, nav, footer) and functional pages (login, cart, checkout, order, track) keep rendering from SAP, so the storefront works end-to-end from the moment you start — and you manage just the marketing content headlessly. Commerce (products, cart, checkout, users) stays in SAP and hydrates live. See [`occFallback`](#step-4-configure) below and [Concepts › Hybrid rendering](concepts.md).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js `^22.22.0`** | Spartacus `221121.15.1` declares this engine. On older 22.x you'll see non-fatal `EBADENGINE` warnings; Node 20 is **not** sufficient. |
| **Angular CLI 21** | No global install needed — use `npx -p @angular/cli@21 ng …`. |
| **SAP RBSC registry access** | Required to install `@spartacus/*` — they are **not** on public npm. Needs your organization's RBSC entitlement + an `.npmrc` (below). Skip only if you already have a working Spartacus app. |
| A reachable SAP OCC backend | A backend URL + a base site (e.g. `electronics-spa`). The connector doesn't change how Spartacus talks to SAP for commerce. |
| A Contentstack stack | A read-only **delivery token** + **API key** for the storefront, and a **preview token** if you use Live Preview. Provisioning the content model uses `csdx auth:login` — no management token in the app. |
| `@contentstack/cli` (`csdx`) | Installed globally for the one-time content-model import (Step 2). Dev machine only. |

> [!IMPORTANT]
> **`@spartacus/*` is not on public npm.** Public npm caps out around `@spartacus/schematics@4.3.8` (Angular 12) — running a bare `ng add @spartacus/schematics` resolves an ancient version and fails against the Angular 21 CLI. The Angular-21 Composable Storefront (release tag **`221121.15.1`**) is distributed **only** via SAP's private RBSC registry. You must configure the `.npmrc` below before Step 0. See [troubleshooting](troubleshooting.md).

### The RBSC `.npmrc` (required to install Spartacus)

Create an `.npmrc` in your project root with your organization's RBSC registry URL and auth:

```ini
@spartacus:registry=https://<YOUR_RBSC_REGISTRY_HOST>/
//<YOUR_RBSC_REGISTRY_HOST>/:_auth=<YOUR_RBSC_BASE64_AUTH>
legacy-peer-deps=true
```

- The registry host and `_auth` come from your **SAP RBSC subscription** — see SAP's RBSC / Composable Storefront installation docs for obtaining them. Treat `_auth` as a **secret**; never commit it.
- `legacy-peer-deps=true` is **required** — Spartacus declares a dense set of exact-version Angular/ngrx peers that npm 7+'s strict resolver rejects. This is SAP's own documented install requirement.

> [!NOTE]
> Use release tag **`221121.15.1`** (the Angular 21 line), **not** `2211.43.0` — the higher number is an older Angular 19 line and won't match this connector's Angular 21 peers.

### Values you'll supply (and where each goes)

Have these ready before you start — the steps below prompt for them as placeholders. The SAP backend values are needed while scaffolding the app; the Contentstack values are needed while provisioning content and wiring the connector.

| Value | Where you get it | Used in |
|---|---|---|
| **OCC base URL** (`<YOUR_OCC_BASE_URL>`) | Your SAP Commerce Cloud backend (e.g. `https://api.<host>:9002`) | [Step 0.2](#02-add-spartacus-from-the-rbsc-registry) — `--base-url` |
| **Base site** (`<YOUR_BASE_SITE>`) | Your SAP storefront site (e.g. `electronics-spa`, `powertools-spa`) | [Step 0.2](#02-add-spartacus-from-the-rbsc-registry) — `--base-site` |
| **Stack API key** (`blt…`) | Contentstack → Settings → Stack | [Step 2](#step-2-provision-the-content-model-demo-seed-csdx) (import) + [Step 4](#step-4-configure) (`delivery.apiKey`) |
| **Delivery token** (`cs…`) | Contentstack → Settings → Tokens → Delivery Tokens (scoped to `development`; created **after** import in Step 2) | [Step 4](#step-4-configure) (`delivery.deliveryToken`) |
| **Environment** | The `development` environment the starter pack ships | [Step 2](#step-2-provision-the-content-model-demo-seed-csdx) + [Step 4](#step-4-configure) (`delivery.environment`) |
| **Region** | Your stack's data center | [Step 2](#step-2-provision-the-content-model-demo-seed-csdx) (`csdx config:set:region`) + [Step 4](#step-4-configure) (`delivery.region`) — must match. **Note the spelling differs:** North America is **`NA`** in csdx but **`US`** in the connector (see the mapping below). |
| **Preview token** (`cs…`, optional) | Contentstack → Settings → Tokens → Delivery Tokens → enable preview | [Step 4](#step-4-configure), only if using Live Preview |

> The OCC base URL and base site are written into config at scaffold time and don't need to be reachable until you `ng serve` — but commerce data (and the `/occ/v2` base page in hybrid mode) won't load until the backend is reachable.

### The end-to-end install path

The steps below split cleanly into two lanes that meet at the end: a **content lane** (create the stack, import the model, publish, mint a delivery token) and a **code lane** (build the Spartacus base app, install the package, wire the module, configure). Neither renders anything on its own — you need the delivery token from the content lane plugged into the config from the code lane before hybrid works.

```mermaid
flowchart TD
    A["Create empty stack<br/>master locale en-us"] --> B["csdx cm:stacks:import<br/>starter pack"]
    B --> C["Publish entries + asset<br/>to development"]
    C --> D["Create delivery token<br/>(read-only)"]
    D --> W

    S0["Step 0: ng new + RBSC .npmrc<br/>ng add @spartacus 221121.15.1"] --> I["npm install connector<br/>+ delivery-sdk"]
    I --> N["ng add (Option A)<br/>or manual wire (Option B)"]
    N --> CFG["Configure<br/>ContentstackConfig"]
    CFG --> W["Run: ng serve"]
    W --> V{"Hybrid working?"}
    V -->|"cdn.contentstack.io<br/>+ /occ/v2/…"| OK["Islands over SAP base"]
    V -->|"only /occ/v2/…"| T["See Troubleshooting"]

    classDef cs fill:#6C5CE7,color:#ffffff,stroke:#4834d4
    class A,B,C,D cs
```
*Content lane (purple) provisions the stack; code lane installs and wires; the delivery token is the hand-off between them.*

---

## Step 0: Create the Spartacus base app

> Skip this step if you already have a running Composable Storefront (`221121.15.1`) app; go to [Step 1](#step-1-install).

### 0.1 Scaffold an Angular 21 project

Use **Angular CLI 21**. Keep the app standalone (the Angular 21 default) but force **classic filenames** with `--file-name-style-guide=2016` — the Spartacus schematic expects the classic `app.module.ts` layout and bridges it for you. Scaffold with **`--skip-install`** so no `npm install` runs before the `.npmrc` is in place:

```bash
NG_CLI_ANALYTICS=false npx -y -p @angular/cli@21 ng new my-storefront \
  --style=scss \
  --file-name-style-guide=2016 \
  --ssr=false \
  --skip-install \
  --defaults
```

`--defaults` suppresses the interactive prompts so it runs unattended. The resulting app is zoneless — Spartacus `221121.15.1` builds and runs on it.

> [!IMPORTANT]
> **Add the `.npmrc` before the first install.** Copy the RBSC [`.npmrc`](#the-rbsc-npmrc-required-to-install-spartacus) into the new `my-storefront/` folder now — its `legacy-peer-deps=true` is required not only to resolve Spartacus's peers but to avoid a known npm 10.x crash (`Cannot read properties of null (reading 'edgesOut')`) that a plain `npm install` on a fresh Angular 21 app hits. Because we used `--skip-install` above, no install has run yet — so add the file, then install:
> ```bash
> cd my-storefront
> # …create .npmrc here…
> npm install
> ```

### 0.2 Add Spartacus (from the RBSC registry)

From inside `my-storefront/`, run the Spartacus schematic **pinned to the Angular-21 release tag** `221121.15.1`, pointed at **your** OCC backend and base site:

```bash
npx ng add @spartacus/schematics@221121.15.1 \
  --skip-confirmation \
  --base-url=<YOUR_OCC_BASE_URL> \
  --base-site=<YOUR_BASE_SITE> \
  --interactive=false
```

This installs `@spartacus/*` (from RBSC) and wires the storefront modules, configuration, styles, and shell.

- **The "Which Spartacus features would you like to set up?" prompt is expected** in interactive mode. Press `Enter` to accept the recommended default set (`Space` toggles, arrows move); `--interactive=false` (above) applies that default set with no prompt.
- **Don't pass `--feature-level=6.7`.** The Angular CLI parses the numeric value as a number and the schematic rejects it (`Data path "/featureLevel" must be string`). Omit it — the schematic applies its default feature level — or set `context.featureLevel` in `spartacus-configuration.module.ts` afterward.
- **Unattended / CI:** the `--features` option can't take a custom subset on the command line. **Omit `--features`** and add `--interactive=false` — the schematic applies the default feature set with no prompt. For a custom subset non-interactively, install the base first, then add each feature with its own schematic (e.g. `ng add @spartacus/tracking`).
- **Self-signed OCC cert:** keep an **absolute** `baseUrl` in the generated config and accept the cert in the browser once. Do **not** switch to `baseUrl: '/'` + a dev proxy — Spartacus then builds protocol-relative `//occ/v2/...` URLs that break.

### 0.3 Verify the plain storefront before adding the CMS

```bash
ng serve --port 4200
```

You should see a working SAP storefront (header, nav, footer, PLP/PDP, cart) with content served entirely from OCC. Once that renders, continue to Step 1 to add Contentstack.

> [!IMPORTANT]
> **A completely blank page here almost always means the OCC cert wasn't accepted.** If your backend uses a self-signed certificate (common for dev), the browser silently blocks every OCC call with `ERR_CERT_AUTHORITY_INVALID` and Spartacus can't bootstrap the site context — so nothing renders, Contentstack included. Open the OCC base URL directly in the same browser once and click through the security warning, then reload. See [troubleshooting](troubleshooting.md#err_cert_authority_invalid-or-http-failure-response--0-undefined-calling-occ).

---

## Step 1: Install

From inside `my-storefront/`, install the connector plus the delivery SDK (the app imports `Region` from it directly):

```bash
npm install @contentstack/contentstack-spartacus-connector @contentstack/delivery-sdk
```

`@contentstack/delivery-sdk` is the runtime client the connector uses to query the Delivery API (it also exports the `Region` enum you reference in config). If you use [`ng add`](#option-a-recommended-ng-add) in Step 3, its schematic also runs a `NodePackageInstallTask` and adds the connector's peer dependencies to your `package.json` for you.

---

## Step 2: Provision the content model, demo seed (csdx)

Create an **empty stack** whose master locale is **English – United States (`en-us`)**, then import the **Content Model Starter Pack** (`import-export/starter-pack/`):

> [!TIP]
> Run the pack's offline preflight check before importing to catch a malformed data-dir early:
> ```bash
> node ./node_modules/@contentstack/contentstack-spartacus-connector/import-export/starter-pack/preflight.mjs
> ```

```bash
npm install -g @contentstack/cli
csdx config:set:region <NA | EU | AZURE-NA | ...>
csdx auth:login                                  # provisioning — dev machine only
csdx cm:stacks:import --stack-api-key <STACK_API_KEY> \
  --data-dir ./node_modules/@contentstack/contentstack-spartacus-connector/import-export/starter-pack \
  --yes
```

One command imports the **17 content types** (4 per-template page types + a `global_slots` shell + 12 component types), the **4 locales** (`en-us` master, plus `de-de`, `ja-jp`, `zh-cn` — each of the three added locales has `fallback_locale: en-us`; the master has none), the **54 seed entry records** (`en-us` + `de-de`, references resolved), the **1 placeholder hero-banner asset**, and creates a **`development`** environment. No manual environment setup is needed — the pack ships `development` for you. See [`import-export/starter-pack/README.md`](../import-export/starter-pack/README.md) for the full manifest.

**Expected output (illustrative — csdx's exact wording varies by CLI version):** csdx logs each module as it imports and finishes with the environment. The shape resembles:

```
Starting import of content types ...
Migrating content type: landing_page ... done
... (17 content types)
Starting import of locales ...  3 locales imported  (de-de, ja-jp, zh-cn; en-us is the master set at stack creation)
Starting import of assets ...   1 asset imported
Starting import of entries ...  54 entries imported
Starting import of environments ... development
The import process has completed successfully.
```

The import stages everything as **draft** (`Entries Publish 0/0` above), so nothing is delivered yet — you must **publish** the seed content to `development`. Do it with the CLI (fastest, reuses the `csdx auth:login` session from above) or in the UI.

**Publish with the CLI (recommended).** Every content type's entries must be published, not just `landing_page` — the home page references banners, carousels, and navigation entries, and an unpublished reference renders as an empty slot.

```bash
# 1) Entries — --filter draft selects exactly what the import created;
#    --publish-mode single avoids the 10-entry bulk-API cap.
csdx cm:stacks:bulk-entries --operation publish --filter draft \
  --environments development --locales en-us de-de \
  --publish-mode single \
  --stack-api-key <STACK_API_KEY> --yes

# 2) Asset — the hero-banner image (an unpublished asset shows as a broken
#    image even when its entry is live).
csdx cm:stacks:bulk-assets --operation publish \
  --environments development --locales en-us \
  --stack-api-key <STACK_API_KEY> --yes
```

Expect `54 success, 0 failed` for entries (~11s) and `1 success, 0 failed` for the asset. (Entries with no `de-de` localization publish in `en-us` only — that's fine; they fall back to master.)

**Or publish in the UI.** Select **all** imported entries (across every content type) and bulk-publish them to `development` in `en-us` (plus `de-de` where a German version exists), then publish the hero-banner asset to `development`.

**Delivery token.** Create one for `development` (Settings → Tokens → Delivery Tokens, scoped to `development`) if you don't already have one. That delivery token plus the stack API key are the only Contentstack credentials the storefront needs.

> [!TIP]
> **Verify in the UI before wiring the app.** In the Contentstack UI, open the `landing_page` **Home** entry and confirm it shows **Published** on `development`; a quick way to check delivery works is the entry's *Published* badge plus the referenced banner/carousel/nav entries also showing published. If the entries are green in the UI, the delivery token will return them.

**Common pitfalls**

- **Wrong master locale.** The pack's entries are authored in `en-us`; a stack whose master locale is anything else will mis-resolve fallbacks. Create the stack with `en-us` as master before importing.
- **Region mismatch.** `csdx config:set:region` must match the stack's data center, and the same region has to be set on `delivery.region` in Step 4 — otherwise the storefront queries the wrong host and gets empty content. **The two tools spell the same region differently** — csdx uses `NA`/`EU`/`AZURE-NA`/…, while the connector (`--region` / `Region.*`) uses `US`/`EU`/`AZURE-NA`/…:

  | Data center | csdx (`config:set:region`) | Connector (`--region` / `Region.*`) |
  |---|---|---|
  | North America | `NA` | `US` / `Region.US` |
  | Europe | `EU` | `EU` / `Region.EU` |
  | Azure NA | `AZURE-NA` | `AZURE-NA` / `Region.AZURE_NA` |
  | Azure EU | `AZURE-EU` | `AZURE-EU` / `Region.AZURE_EU` |
  | GCP NA | `GCP-NA` | `GCP-NA` / `Region.GCP_NA` |
  | GCP EU | `GCP-EU` | `GCP-EU` / `Region.GCP_EU` |

  Only **North America differs** (`NA` vs `US`); the rest match. A stack on NA uses `csdx config:set:region NA` **and** `--region=US`.
- **Nothing renders after import.** The import stages content as *draft*. Until you **publish** the entries and asset to `development` (CLI or UI, above), the delivery token returns nothing.
- **Partial data-dir.** Point `--data-dir` at the full starter-pack folder, not a subfolder — csdx expects a complete export skeleton (every module folder + a `global_fields` file) and crashes on an incomplete one.

> [!INFO]
> **Two-token model:** the privileged credential (`csdx auth:login`, or a scoped/expiring management token) provisions the stack once on your dev machine and never leaves it, while the storefront ships only the read-only **delivery token** it uses for Delivery API queries at runtime — never commit the management credential, never ship it. See [The two-token security model](concepts.md#the-two-token-security-model).

---

## Step 3: Wire the module

### Option A (recommended): `ng add`

```bash
ng add @contentstack/contentstack-spartacus-connector
```

One interactive command generates an app-side `ContentstackFeatureModule` (with your `provideConfig(<ContentstackConfig>{…})`) and adds it to your `SpartacusFeaturesModule`. It prompts for region (a pick-list), Live Preview (y/n), fallback options, and credentials (blank answers scaffold `<PLACEHOLDER>`s to fill later). This wires **code/config** only — content still comes from the csdx starter-pack import in Step 2.

**What it writes** (paths relative to your project `sourceRoot`, usually `src/`):

| File | Purpose |
|---|---|
| `app/spartacus/features/contentstack/contentstack-feature.module.ts` | The generated `ContentstackFeatureModule` — imports `ContentstackCmsFeatureModule` and provides your `ContentstackConfig`. |
| `environments/contentstack.environment.ts` | Delivery credentials, exported as `contentstackDelivery` and imported by the feature module. |
| `app/spartacus/spartacus-features.module.ts` | Modified in place — `ContentstackFeatureModule` is added to its `imports`. |

The generated feature module scaffolds `localeMapping: { en: 'en-us', de: 'de-de' }` and `accessControl: { enabled: false }` on purpose (even at their defaults) so they're easy to find and turn on — a missing `localeMapping` is the usual cause of blank pages.

Pass answers as **kebab-case** flags for non-interactive/CI installs (the Angular CLI dasherizes multi-word schema options):

```bash
ng add @contentstack/contentstack-spartacus-connector \
  --api-key=… --delivery-token=… --environment=development \
  --region=US --cms-page-content-type=landing_page \
  --occ-fallback=true --include-fallback=false \
  --live-preview=false --interactive=false
```

The full flag set (from [`schematics/add-contentstack/schema.json`](../schematics/add-contentstack/schema.json)):

| Flag | Type / values | Default |
|---|---|---|
| `--api-key` | string (`blt…`) | scaffolds `<STACK_API_KEY>` |
| `--delivery-token` | string (`cs…`) | scaffolds `<DELIVERY_TOKEN>` |
| `--environment` | string | scaffolds `<ENVIRONMENT>` |
| `--region` | `US` \| `EU` \| `AZURE-NA` \| `AZURE-EU` \| `GCP-NA` \| `GCP-EU` | `US` |
| `--cms-page-content-type` | string | `landing_page` |
| `--occ-fallback` | boolean | `true` |
| `--include-fallback` | boolean | `false` |
| `--live-preview` | boolean | `false` |
| `--preview-token` | string (`cs…`) | scaffolds `<PREVIEW_TOKEN>` (emitted only when `--live-preview=true`) |
| `--project` | string | first project in `angular.json` |
| `--debug` | boolean | `false` |

The `--region` key is mapped to the `Region` enum member from `@contentstack/delivery-sdk` (`AZURE-NA` → `Region.AZURE_NA`, and so on) when the env file is generated.

Delivery credentials are written to **`src/environments/contentstack.environment.ts`** (referenced from the generated module), not inlined in the NgModule — so they stay out of the committed module and can be swapped per environment via Angular's `fileReplacements`. Fill any `<PLACEHOLDER>`s there.

**The `fileReplacements` pattern.** Keep the generated `contentstack.environment.ts` as your development credentials and mirror it per build target. In `angular.json`, the production configuration swaps in a production copy at build time:

```jsonc
// angular.json → projects.<app>.architect.build.configurations.production
"fileReplacements": [
  {
    "replace": "src/environments/contentstack.environment.ts",
    "with": "src/environments/contentstack.environment.prod.ts"
  }
]
```

The two files export the same `contentstackDelivery` shape with different `environment`/token values (and the prod copy omits `livePreview`/`previewToken`). Because the feature module imports the symbol, not a literal, no code changes — only the file the build resolves.

> [!WARNING]
> **Preview token is a secret.** A `previewToken` is emitted **only when you enable Live Preview**, and it grants read access to *unpublished* draft content. Use it only in a non-production build and do **not** commit a real value (git-ignore the env file if it holds one). The connector also refuses to activate Live Preview when the app runs in production mode, so a stray preview build can't leak drafts to end users.

### Option B: manual

If you'd rather wire it by hand, import the connector's feature module in `spartacus-features.module.ts` **after** the stock Spartacus feature/OCC modules. Angular DI is last-provider-wins, so import order is what lets the connector's CMS adapters sit in front of the OCC ones:

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

With the manual path you provide the config yourself (Step 4) rather than having `ng add` scaffold it. `ContentstackCmsFeatureModule` is the single entry point: it registers the connector's default config and **eagerly imports** the CMS override module (`ContentstackCmsModule`) and the Live Preview module (`ContentstackLivePreviewModule`). The import is deliberately eager — the CMS adapter has to be in the DI graph *before* the first page resolves at bootstrap — so the connector does **not** use the lazy `CmsConfig.featureModules` gate (that gate only fires when a feature-tagged `cmsComponents` entry renders, which this library never registers). Importing `ContentstackCmsFeatureModule` after the base modules is all the wiring you need.

> [!WARNING]
> **Ordering matters — and failures are silent.** If `ContentstackCmsFeatureModule` is imported *before* the stock Spartacus modules (or omitted), the OCC adapters win the DI race, pages keep rendering straight from SAP OCC, and **no error is thrown**. If content isn't coming from Contentstack, check this ordering first.

---

## Step 4: Configure

`ng add` generates this block for you inside the feature module; add it yourself if you took the manual path. In `spartacus-configuration.module.ts` (or the generated `contentstack-feature.module.ts`):

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
- **`region`** — set on `delivery` to match your stack's data center (`Region.US` / `EU` / `AZURE_NA` / …), and it must match the region you provisioned the stack under in Step 2.
- **`cmsPageContentType`** is the single per-route page type queried by slug; the starter pack authors the home as `landing_page`. Shared-layout pages (product, category) map through `pageTypeMapping` instead.

The `ContentstackConfig` interface augments Spartacus's `Config`, so your editor autocompletes and type-checks the whole block with each field's JSDoc on hover. See [configuration](configuration.md) for the full option set.

---

## Step 5: (Only for custom components) map content types to Angular components

The editorial starter-pack types (banner, carousel, paragraph, link, …) map to **stock** Spartacus components automatically via their SAP typecodes — no config needed. You only add a `cmsComponents` mapping for your **own** components; follow [`src/examples/hero-banner/custom-hero.module.ts`](../src/examples/hero-banner/custom-hero.module.ts).

The `cmsComponents` map key **must equal** the SAP typecode the normalizer emits (see [Field naming and SAP mapping](content-model.md#field-naming-and-sap-mapping)).

---

## Step 6: Run

```bash
ng serve   # or your SSR command
```

Open `http://localhost:4200/` (or your dev port). **If the page is blank on first load, that's expected** when the SAP backend uses a self-signed cert — accept it in [Step 7](#step-7-accept-the-sap-backends-tls-cert-one-time-per-browser), then confirm hybrid rendering in [Step 8](#step-8-verify).

---

## Step 7: Accept the SAP backend's TLS cert (one-time per browser)

**The page will be blank on first load — that's expected** if your SAP Commerce backend uses a self-signed certificate (normal for dev/local). The browser rejects it with `ERR_CERT_AUTHORITY_INVALID` and blocks every OCC call (status `0` in the Network tab), so Spartacus can't fetch base-site/product data and nothing renders — Contentstack content included, because the connector's page adapter never runs until the site context bootstraps from OCC.

**Fix (dev only):**

1. In the **same browser**, open your OCC base URL directly — e.g. `<YOUR_OCC_BASE_URL>/occ/v2/basesites`.
2. Click through the security warning (**Advanced → Proceed**) to add an exception for that origin.
3. Reload `http://localhost:4200/` (or your dev port) — it now hydrates, and you'll see the hybrid dual traffic described in [Step 8](#step-8-verify).

> [!NOTE]
> **SSR builds:** there's no browser to click through, so start the SSR server with `NODE_TLS_REJECT_UNAUTHORIZED=0` — **dev only, never in production**. Production SAP Commerce backends have valid, CA-signed certs, so none of this applies there. See [troubleshooting › ERR_CERT_AUTHORITY_INVALID](troubleshooting.md#err_cert_authority_invalid-or-http-failure-response--0-undefined-calling-occ).

---

## Step 8: Verify

Expect:
1. The full **SAP shell** (header, nav, footer) + functional pages render from OCC — the store works end-to-end.
2. Slots you authored in Contentstack (e.g. the home hero/carousel) render as **islands** over that base. DevTools → Network shows **both** `cdn.contentstack.io` (content) **and** `/occ/v2/...` (base + commerce) — that's hybrid working.
3. Switching site language reloads the Contentstack content in the matching locale (or falls back to master where unlocalized).

**What "hybrid working" looks like in DevTools.** Open DevTools → Network, filter, and reload the home page:

- A request to **`cdn.contentstack.io`** (or your region's delivery host) returning the `landing_page` entry with its resolved slot references — this is Contentstack serving the authored islands.
- Requests to **`/occ/v2/<site>/...`** for the base page structure and for live commerce data (product price/stock, cart) — this is SAP serving the base and hydrating commerce.
- Seeing **only** `/occ/v2/...` and no `cdn.contentstack.io` call means the connector isn't intercepting — recheck module import ordering ([Option B](#option-b-manual)) and that `localeMapping` resolves to a locale your stack actually has. See [troubleshooting](troubleshooting.md).
- Switching the site language should fire a fresh Contentstack query in the mapped locale; the seed's `de-de` menus relabel (e.g. *Cameras → Kameras*) while `ja`/`zh` fall back to English.

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
