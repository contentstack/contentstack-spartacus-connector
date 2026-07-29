# B2B (Powertools) Full-Parity Pack

A full-parity migration of the **Contentful SAP Commerce Powertools** demo into
Contentstack CLI (`csdx`) import format. This is the **B2B / Powertools** content
set: every page, banner, paragraph, carousel, navigation tree, media container and
image from the Contentful demo, mapped to the connector's model. See
`../../CONTENT-MODEL.md` for the model design.

> This pack **supersedes the earlier small M1 seed**. It was produced from the
> Contentful export by `convert-from-contentful.mjs` (below). The two
> hand-authored generators (`generate-content-types.mjs` / `generate-seed.mjs`)
> remain as the reference for the *small* seed shape.

## Contents

- `content_types/` — **26 content types**: 14 per-template page types
  (`landing_page`, `content_page`, `product_page`, `category_page`, `company_page`,
  `account_page`, `login_page`, `cart_page`, `checkout_page`,
  `order_confirmation_page`, `store_finder_page`, `search_results_list_page`,
  `error_page`, `quote_details_page`) + 11 editorial component types
  (banner, product carousel, paragraph, link, nav node, category/footer/account
  navigation, media container, tab paragraph + container) + `global_slots` (shell).
- `entries/` — **335 entry records** (`en-us` + `de-de`): all 58 Contentful pages,
  20 banners, 10 paragraphs, carousels, 45 links, nav trees, 11 media containers,
  tab content. `ja-jp`/`zh-cn` intentionally **unlocalized** (master fallback).
- `assets/` — **50 images** (csdx chunked asset module + binaries under `files/`).
- `locales/` — `en-us` (master) + `de-de`, `ja-jp`, `zh-cn` (all fall back to `en-us`).

### "Everything meaningful, skip the plumbing"
Purely-functional Contentful component types that hold no editable content and
hydrate from SAP OCC — `CMSFlexComponent` (120), `BreadcrumbComponent`,
`SearchBoxComponent`, `MiniCartComponent`, refinement / product-list / add-to-cart
/ variant-selector / site-context / product-references — are **skipped**, and
references to them are dropped. Those slots render from OCC in the hybrid model.

## Regenerate from the Contentful export

```bash
node import-export/b2b-starter-pack/convert-from-contentful.mjs
```

Reads `../../../composable-storefront-integration-library/import-export/powertools-demo-data-import/import-data/import-data.json`
and rewrites `content_types/`, `entries/`, `assets/`, and the csdx skeleton. Field
and slot names come from the connector's `src/cms/model/slot-maps.ts`
(`TYPECODE_MAP` / `SLOT_FIELD_TO_SAP_NAME`) so imported content renders as-is.

## Import into a stack

Create an **empty stack** whose master locale is **English - United States (`en-us`)**, then:

```bash
npm install -g @contentstack/cli
csdx config:set:region <NA | EU | AZURE-NA | ...>
csdx auth:login                                  # provisioning — dev machine only
csdx cm:stacks:import --stack-api-key <YOUR_STACK_API_KEY> \
  --data-dir ./import-export/b2b-starter-pack --yes
```

This imports **26** content types, **4** locales, **50** assets, and **335** entry
records, and creates a **`development`** environment. Then **publish** the entries
+ assets to `development` (import creates but does not publish) and create a
**delivery token** for that environment.

> Entries ship with an empty `publish_details` array (secret-free), so import does
> not auto-publish. Publish from the Contentstack UI, or via the CMA / a
> `cm:entries:publish` bulk-publish run.

## Validate before importing (offline)

```bash
csdx cm:stacks:audit --data-dir ./import-export/b2b-starter-pack --show-console-output
```

✅ **Audited clean** with `@contentstack/cli` v2.0: **26 content types, 335 entries,
50 assets, 26 field-rules — 0 fixable, 0 non-fixable.**

> **Why the pack is a full csdx export skeleton:** csdx imports a *complete* export
> data-dir — every module folder must exist (its import-time audit loads prerequisite
> data from each) plus a `global_fields` file, and every entry needs a
> `publish_details` array. The converter produces the complete, secret-free skeleton
> so a plain `--data-dir … --yes` just works.

## Rendering notes (connector config)

- **Per-template routing.** The connector resolves a default `cmsPageContentType`
  (`landing_page` for `/`) plus a **`contentTypeByUrl`** map for other routes, e.g.
  `{ '/organization': 'company_page' }`, so each route resolves to its per-template
  content type. (This replaces the earlier single-content-type limitation.)
- **Banner images via `media_container`.** Banners reference a `media_container`
  entry holding the per-breakpoint images (a two-level reference). The connector
  requests the nested `<slot>.media_container` includes and resolves them; the
  banner normalizer accepts the container as a single ref or a single-element array
  and reads either `desktop`/… or `media_desktop`/… breakpoint field names.
- **B2B "My Company" tiles.** The `/organization` tiles are banners with an icon +
  `headline` + `content`; the stock `cx-banner` shows the image only, so render them
  with a small app component that reads `headline`/`content` (see
  `powertools-commerce-app`'s `cms-banner.component.ts`). Installing
  `@spartacus/organization` provides the `CompanyPageTemplate` layout + B2B org UI.

## Two-token security
- **Runtime = delivery token** (read-only) — the only Contentstack credential in the storefront.
- **Provisioning = `csdx auth:login`** (or a scoped, expiring management token) — dev
  machine only, never committed, never shipped.
