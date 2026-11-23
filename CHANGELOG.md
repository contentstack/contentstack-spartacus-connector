# Changelog

All notable changes to `@contentstack/contentstack-spartacus-connector` are listed here.
The project follows [Semantic Versioning](https://semver.org); while the version is
`0.x`, a minor release can change behaviour, so `^0.1.0` does not pick up `0.2.0`.

## 0.2.0 (2026-11-23)

### Added

- Product carousels read their SKUs from the SAP Commerce Cloud app's product picker
  field (`sap_products`) and fall back to the plain `products` list when the picker
  field is empty or missing (DX-33290, #39). In Live Preview and Visual Builder, the
  carousel's product list carries a `sap_products` edit tag, so clicking it opens the
  picker.
- Visual Builder editing:
  - slot and slot-position edit tags (DX-27689)
  - editable navigation items (DX-27704)
  - follows Visual Builder's locale (DX-27690)
  - editable paragraph, banner and product-carousel renderers, on by default through
    the feature module
- Starter pack: the `content` field of `cms_paragraph_component` and
  `cms_tab_paragraph_component` is now HTML rich text (DX-31554, #29). Stacks that
  already imported the pack keep their old field.
- Live Preview: one activation rule and a kickstart SDK init (DX-32787).

### Fixed

- Live Preview keeps the Timeline context on edit re-fetches (DX-32786), and re-fetches
  through Spartacus's CMS pipeline so static slots stay on the page.
- A Visual Builder language switch keeps navigation, carousels and banners (DX-27690),
  never holds the SDK handshake, and only accepts locale messages from the Visual
  Builder origin.
- The banner edit tag sits on the image, not a full-cover wrapper (DX-27705).
- Preview `$` tags are stripped before the field mapper, so they never leak into
  custom component types.
- Cache keys are injective, and the navigation builder was simplified.

### Security

- Cleared Snyk SAST findings and updated vulnerable transitive dependencies.

### Upgrading

- Change the dependency to `^0.2.0` (a `^0.1.0` range does not install it).
- To use the picker, install the SAP Commerce Cloud app in the stack and add a
  `sap_products` field to `product_carousel_component`. The `dx-sap-spartacus-import`
  agent skill does both when it seeds a stack. Entries that only have `products` keep
  working.

## 0.1.0 (2026-08-25)

First release. See the
[v0.1.0 release notes](https://github.com/contentstack/contentstack-spartacus-connector/releases/tag/v0.1.0).
