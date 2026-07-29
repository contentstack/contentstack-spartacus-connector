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

**Routing per-template types.** The connector resolves the home / default route via
`cmsPageContentType`, and every other route via the `contentTypeByUrl` config map
(slug → content-type uid), e.g. `{ '/organization': 'company_page' }`. Each route is
still matched by its own slug; routes not listed fall back to `cmsPageContentType`
(then to OCC). This is how a stack with many per-template page types is served
without one superset `cms_page`.

### 3.2 Component content types (the reusable blocks)

| Content type (uid) → SAP typeCode | Key fields |
|---|---|
| `simple_responsive_banner_component` → SimpleResponsiveBannerComponent | `title`, `url_link`, `media`, `media_mobile`, `media_tablet`, `media_desktop`, `media_widescreen` (file) |
| `simple_banner_component` → SimpleBannerComponent | `title`, `url_link`, `media*` |
| `product_carousel_component` → ProductCarouselComponent | `title`, `products` (multi-value text: SKUs) |
| `cms_paragraph_component` → CMSParagraphComponent | `title`, `content` (multiline/rich text) |
| `cms_link_component` → CMSLinkComponent | `title`, `link_name`, `url`, `target` |
| `cms_flex_component` → CMSFlexComponent | `title`, `flex_type` |
| `nav_node` (+ `category_navigation_component`, `footer_navigation_component`) | nav tree: `uid_val`, `title`, `children` (→nav_node), `entries` (→cms_link_component) |

Functional components (search box, mini-cart, breadcrumb, add-to-cart, refinements, …) carry **no
editorial data** — they hydrate from OCC. In hybrid mode you usually don't author these at all;
OCC serves them. Include only the ones you intend to place via Contentstack.

### 3.3 Field naming ↔ SAP mapping (why lowercase)

Contentstack field uids must be lowercase `snake_case`; SAP typecodes/positions are `PascalCase`.
The connector maps both directions (`toTypeCode`, `toSlotName`, `SLOT_FIELD_TO_SAP_NAME`), so
authors use clean names and rendering still hits the right SAP component/slot.

## 4. Custom slots (unlimited)

To add a slot beyond the standard set, three small additions (no connector cap):
1. **Storefront**: declare `<cx-page-slot position="MyPromoStrip">` + its `LayoutConfig` entry.
2. **Connector config**: `additionalSlotFields: { my_promo_strip: 'MyPromoStrip' }`.
3. **Content type**: add a `my_promo_strip` reference field.

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
