# Content Model — Starter Pack Reference

> Reference for the content types and slots you author in Contentstack. The starter pack in
> `import-export/starter-pack/` provisions this model into a stack; see its README to import it.

## 1. The authoring model (hybrid recap)

The connector renders **SAP Commerce (OCC) as the base for every page** and lets Contentstack
**override only the slots you author** — "editable Contentstack islands within the SAP page."
So the content model only needs to cover the **content you actually manage headlessly**
(home hero, promos, landing/content pages, shell if you take it over) — *not* the entire
storefront. The shell, functional pages (login/cart/checkout/order/track), and any
unauthored slot come from OCC automatically.

**Unit of control = the slot.** Author a slot → it's a Contentstack island; leave it → OCC fills it.

## 2. Slot reference (the "list of valid slots")

Slot names are **not arbitrary** — they are Spartacus's template **positions**, defined by the
storefront's `LayoutConfig`. A slot only renders if its template declares it. You author a
**lowercase field** in Contentstack; the connector maps it to the **PascalCase SAP position**.

| SAP template (page type) | SAP slot positions | Contentstack field uid |
|---|---|---|
| **Shell** (header/footer, every page) | `SiteLogo`, `SearchBox`, `MiniCart`, `NavigationBar`, `SiteContext`, `SiteLinks`, `HeaderLinks`, `Footer` | `site_logo`, `search_box`, `mini_cart`, `navigation_bar`, `site_context`, `site_links`, `header_links`, `footer` |
| **LandingPage2Template** (home/landing) | `Section1`, `Section2`, `Section2A`, `Section2B`, `Section2C`, `Section3`, `Section4`, `Section5` | `section1`, `section2`, `section2_a`, `section2_b`, `section2_c`, `section3`, `section4`, `section5` |
| **ContentPage1Template** (FAQ, terms, …) | `Section1`, `Section2A/B/C`, `Section3`, `BodyContent`, `SideContent` | `section1`, `section2_a/b/c`, `section3`, `body_content`, `side_content` |
| **ProductDetailsPageTemplate** (PDP) | `Summary`, `UpSelling`, `CrossSelling`, `Tabs`, `PlaceholderContentSlot` | `summary`, `up_selling`, `cross_selling`, `tabs`, `placeholder_content_slot` |
| **ProductListPageTemplate** (PLP/category/search) | `ProductLeftRefinements`, `ProductGridSlot`, `ProductListSlot`, `SearchResultsGridSlot` | `product_left_refinements`, `product_grid_slot`, `product_list_slot`, `search_results_grid_slot` |
| **CartPageTemplate** | `TopContent`, `CenterLeftContentSlot`, `CenterRightContentSlot`, `EmptyCartMiddleContent` | `top_content`, `center_left_content_slot`, `center_right_content_slot`, `empty_cart_middle_content` |

(Full mapping lives in `src/cms/model/slot-maps.ts` → `SLOT_FIELD_TO_SAP_NAME`.)

**How to discover the slots for any page** (since OCC already renders it):
1. Inspect the live page — `<cx-page-slot position="Section1">` — the `position` is the slot name.
2. `GET /occ/v2/<site>/cms/pages?...` → each `contentSlot.position`.
3. SmartEdit / Backoffice slot labels.

## 3. Content types — self-documenting, per-template

Principle: instead of one giant `cms_page` with every slot field, ship **one page content type
per template**, exposing **only that template's slot fields**, each with a friendly display name
and help text. Editors then see only relevant, labelled fields.

### 3.1 Page content types

Common fields on every page type: `title` (required), `url` (slug), `page_type`, `template`.
Each **slot field is a multi-reference** to the component content types below.

| Content type (uid) | Template | Slot fields (reference) |
|---|---|---|
| `landing_page` | LandingPage2Template | `section1`, `section2`, `section2_a`, `section2_b`, `section2_c`, `section3`, `section4`, `section5` |
| `content_page` | ContentPage1Template | `section1`, `section2_a`, `section2_b`, `section2_c`, `section3`, `body_content`, `side_content` |
| `product_page` | ProductDetailsPageTemplate | `summary`, `up_selling`, `cross_selling`, `tabs`, `placeholder_content_slot` |
| `category_page` | ProductListPageTemplate | `product_left_refinements`, `product_grid_slot`, `product_list_slot`, `search_results_grid_slot` |
| `global_slots` | shell (merged into every page) | `site_logo`, `search_box`, `mini_cart`, `navigation_bar`, `site_context`, `site_links`, `header_links`, `footer` |

Help-text pattern per slot field, e.g. on `landing_page.section1`:
> *"Top hero band (SAP slot `Section1`). Add a banner/carousel to override just this section; leave empty to keep SAP's."*

> **Per-template content types.** One page content type per template, each exposing only its
> template's slot fields (with display names + help text) — so editors see only the relevant,
> labelled fields rather than one large superset `cms_page`.

### 3.2 Component content types (the reusable blocks)

| Content type (uid) → SAP typeCode | Key fields |
|---|---|
| `simple_responsive_banner_component` → SimpleResponsiveBannerComponent | `title`, `url_link`, `media_container` (→media_container), `media`, `media_mobile`, `media_tablet`, `media_desktop`, `media_widescreen` (file) |
| `simple_banner_component` → SimpleBannerComponent | `title`, `url_link`, `media_container` (→media_container), `media*` |
| `media_container` → MediaContainer | `title`, `desktop`, `mobile`, `tablet`, `widescreen` (file) — a reusable image set referenced from a banner's `media_container` field |
| `product_carousel_component` → ProductCarouselComponent | `title`, `products` (multi-value text: SKUs) |
| `cms_paragraph_component` → CMSParagraphComponent | `title`, `content` (multiline/rich text) |
| `cms_tab_paragraph_component` → CMSTabParagraphComponent | `title`, `content` (multiline/rich text) — same shape and renderer as `cms_paragraph_component`; SAP just tracks it as a distinct type |
| `cms_link_component` → CMSLinkComponent | `title`, `link_name`, `url`, `target` |
| `cms_flex_component` → CMSFlexComponent | `title`, `flex_type` |
| `cms_tab_paragraph_container` → CMSTabParagraphContainer | `title`, `component_uid` (optional stable id), `tab_components` (multiline text: a pasted JSON array of `{uid, type_code}`) — a tab strip whose panels hydrate **from OCC by component id**; see below |
| `nav_node` (+ `category_navigation_component`, `footer_navigation_component`) | nav tree: `uid_val`, `title`, `children` (→nav_node), `entries` (→cms_link_component) |

Functional components (search box, mini-cart, breadcrumb, add-to-cart, refinements, …) carry **no
editorial data** — they hydrate from OCC. In hybrid mode you usually don't author these at all;
OCC serves them. Include only the ones you intend to place via Contentstack.

Every editorial component type above (and the `landing_page` / `content_page` page types) also
carries an optional **`access_tags`** field for content gating — see §4.5.

#### Media Container — resolving a nested reference

`media_container` is referenced *from inside* a banner entry, not placed directly in a slot. To
resolve it, Contentstack needs the full nested path in `includeReferences` — a bare `section1`
resolves the banner, but not the banner's own `media_container` field. Extend the storefront's
config per slot you use it in:

```ts
includeReferences: [...defaultContentstackConfig.contentstack.includeReferences!, 'section1.media_container']
```

Without this, the field resolves as an unexpanded pointer, `isMediaContainer()` returns `false`,
and the banner normalizer silently falls back to its direct per-breakpoint fields (harmless, just
not what you authored). If you only use the direct `media`/`media_<breakpoint>` file fields, no
config change is needed.

#### Tab Paragraph Container — functional tabs, not editorial content

`cms_tab_paragraph_container`'s `tab_components` field is plain multiline text — Contentstack's
Content Type API doesn't accept a native `json` schema field, so paste a JSON array as text
instead; the normalizer parses it with `JSON.parse`. It describes **existing SAP CMS component
ids** (e.g. `ProductDetailsTabComponent`), one per tab, in display order:

```json
[
  { "uid": "tab_details", "type_code": "ProductDetailsTabComponent" },
  { "uid": "tab_specs", "type_code": "ProductSpecsTabComponent" }
]
```

Each panel's content hydrates from SAP OCC by that `uid` — it is **not** authored in Contentstack.
`cms_tab_paragraph_component` is a separate, ordinary editorial paragraph type (identical to
`cms_paragraph_component`); it is not itself a tab panel unless your app also configures
`contentstack.componentContentType` to resolve standalone lookups against it.

#### Tab labels (i18n)

The tab **headers** are not authored content — Spartacus's `TabParagraphContainerComponent`
derives each header from an i18n key, `<container>.tabs.<tabUid>`, resolved in the `product`
translation namespace. `<container>` is the container's `component_uid` when set, else this
entry's own uid; `<tabUid>` is each entry in `tab_components`. So a container with
`component_uid: "TabPanelContainer"` and a tab `uid: "tab_details"` looks up
`product:TabPanelContainer.tabs.tab_details`. If nothing defines that key, the header renders the
raw key string. Two ways to give tabs real labels:

**Path A — reuse Spartacus's built-in labels (zero config).** Set `component_uid` to
`TabPanelContainer` and name each tab `uid` after a stock Spartacus tab component id. Spartacus's
own `@spartacus/assets` already ships labels for those keys, so the tabs render labelled with no
translation work at all:

```json
[
  { "uid": "ProductDetailsTabComponent", "type_code": "ProductDetailsTabComponent" },
  { "uid": "ProductSpecsTabComponent",   "type_code": "ProductSpecsTabComponent" }
]
```

(Stock ids with built-in labels include `ProductDetailsTabComponent` → "Product Details",
`ProductSpecsTabComponent` → "Specs", `ProductReviewsTabComponent` → "Reviews", and
`SparePartsTabComponent` → "Spare Parts".) This is the recommended default — because Contentstack
lets you choose readable uids, you can line them up with the stock ids and inherit labels for
free.

**Path B — author your own labels for custom tab uids.** If you use custom uids (e.g.
`tab_details`), add a small translation resource in your storefront's i18n config, merged under
`product.<component_uid>.tabs`. Because `TabPanelContainer` is already a registered key in the
stock `product` translation chunk, no `translationChunksConfig` change is needed when
`component_uid` is `TabPanelContainer`:

```ts
provideConfig(<I18nConfig>{
  i18n: {
    resources: {
      en: {
        ...translationsEn,
        product: {
          ...translationsEn.product,
          TabPanelContainer: {
            ...translationsEn.product.TabPanelContainer,
            tabs: {
              ...translationsEn.product.TabPanelContainer.tabs,
              tab_details: 'Details',
              tab_specs: 'Specifications',
            },
          },
        },
      },
    },
  },
})
```

Add the same keys per locale you support; the header then localizes with the rest of the
Spartacus UI chrome. (If you set `component_uid` to something *other* than `TabPanelContainer`,
also add that id to `translationChunksConfig.product` so the lazy loader picks the key up.)

> **Content vs. chrome.** This is only about the tab *header* strings (UI chrome, owned by the
> app's Spartacus i18n). The tab *content* — and all other authored content — localizes the
> normal way, through Contentstack locales + the connector's `localeMapping` / `includeFallback`;
> no translation resources are involved in that path.

### 3.3 Field naming ↔ SAP mapping (why lowercase)

Contentstack field uids must be lowercase `snake_case`; SAP typecodes/positions are `PascalCase`.
The connector maps both directions (`toTypeCode`, `toSlotName`, `SLOT_FIELD_TO_SAP_NAME`), so
authors use clean names and rendering still hits the right SAP component/slot.

## 4. Custom slots (unlimited)

To add a slot beyond the standard set, three small additions (no connector cap):
1. **Storefront**: declare `<cx-page-slot position="MyPromoStrip">` + its `LayoutConfig` entry.
2. **Connector config**: `additionalSlotFields: { my_promo_strip: 'MyPromoStrip' }`.
3. **Content type**: add a `my_promo_strip` reference field.

## 4.5 Content gating (presentation-level, opt-in)

Editorial component types and the per-route page types (`landing_page`, `content_page`) carry an
optional multi-value text field **`access_tags`**. It gates who *sees* an entry — hidden from users
who don't hold the required tokens. Off unless the storefront turns it on.

**Token convention** (values you put in `access_tags`; empty = visible to everyone):
- `_require-login` — hidden from anonymous visitors.
- `_require-anonymous` — hidden once the user logs in.
- `_require-<roleGroupId>` — visible only to users in that SAP role group, e.g.
  `_require-b2badmingroup` (the id must match the SAP group exactly).

An entry is shown only if the user holds **every** `_require-*` token on it; tokens not starting
with the role prefix are ignored (so editorial tags don't gate anything).

**Turn it on** (storefront config):

```ts
provideConfig(<ContentstackConfig>{
  contentstack: { accessControl: { enabled: true } },
});
```

Anonymous-vs-login gating works with no further wiring. **Role-level** gating additionally needs the
app to point the connector at the logged-in user (the connector deliberately doesn't depend on
`@spartacus/user`):

```ts
import { UserAccountFacade } from '@spartacus/user/account/root';
import { CONTENTSTACK_CURRENT_USER } from '@contentstack/contentstack-spartacus-connector';

{ provide: CONTENTSTACK_CURRENT_USER, useFactory: (u: UserAccountFacade) => u.get(), deps: [UserAccountFacade] }
```

Defaults are configurable (`accessField`, `anonymousToken`, `loginToken`, `rolePrefix`,
`gateSharedSlugPages`) — see `ContentstackConfig.accessControl`.

> **Not a security boundary.** Gated entries are still fetched from the Delivery API (the delivery
> token ships in the client bundle) and dropped before render — a determined user can read them via
> the API/devtools. Use it to tailor what the UI shows, not to protect confidential data. Shared-slug
> product/category pages are not gated by default (`gateSharedSlugPages: false`), and the global
> shell (header/footer/nav) is never gated.

## 5. What the seed should contain (small, marketing-only)

Just enough to demonstrate the islands model over the OCC base:
- 1 `global_slots` entry (optional — only if you want a Contentstack-managed shell; else OCC shell shows).
- 1 `landing_page` for `/` (home) with a hero (`section1`) + a promo carousel (`section3`).
- 1 `content_page` (e.g. a campaign/FAQ page).
- 1–2 single-slot overrides to show "9 sections from SAP, 1 from Contentstack".

Everything else (login, cart, checkout, account, order, track) is **left to OCC** — no seed needed.

## 6. Editor experience notes
- Display names + help text on every field (esp. slot fields → name the SAP position + purpose).
- Group/label component types clearly ("Banner", "Carousel", "Link", "Navigation").
- Inline in-page editing is available via `csEditable` on custom components when Live Preview is enabled.

---

See `import-export/starter-pack/README.md` to import this model, and `GETTING_STARTED.md` for the
two-token security model (a read-only delivery token at runtime; `csdx auth:login` only for the
one-time provisioning import).
