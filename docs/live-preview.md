---
title: "Live Preview"
product: spartacus-connector
type: reference
tags: [spartacus-connector, live-preview, visual-builder]
last_updated: "2026-09-09"
---

# Live Preview

Contentstack **Live Preview / Visual Builder** support: entry tagging plus live updates so editors see their changes in-context. Implemented in [`src/live-preview/`](../src/live-preview).

> [!WARNING]
> **Non-production only.** Live Preview is ignored in production builds, and the connector **refuses to activate** it when the app runs in Angular production mode — so a stray preview build can't leak drafts to end users. The `previewToken` grants read access to *unpublished* draft content: treat it as a **secret**, keep it out of committed source and prod.

---

## Enabling it

Set `livePreview: true` (with a `previewToken`) on `contentstack.delivery`:

```ts
provideConfig(<ContentstackConfig>{
  contentstack: {
    delivery: {
      apiKey: '<STACK_API_KEY>',
      deliveryToken: '<DELIVERY_TOKEN>',
      environment: '<ENVIRONMENT>',
      livePreview: true,
      previewToken: '<PREVIEW_TOKEN>',   // secret — non-prod only
      // previewHost: optional; defaults to the US preview host
    },
  },
})
```

With `ng add`, a `previewToken` is emitted **only when you enable Live Preview** during the prompts. See [Step 3 — Wire the module](installation.md#step-3-wire-the-module) and [contentstack.delivery — connection & credentials](configuration.md#contentstackdelivery-connection-credentials).

---

## How it works

`ContentstackCmsFeatureModule` **eagerly** imports `ContentstackLivePreviewModule` — the Live Preview decorator is consulted as components render, which is why it can't be lazy (see [Module composition and DI ordering](architecture.md#module-composition-and-di-ordering)).

The module wires:

| Symbol | Role |
|---|---|
| `ContentstackLivePreviewService` | Sets up the Live Preview SDK, subscribes to live edit events, and triggers content refreshes. |
| `ContentstackAngularService` | Angular-facing bridge that keeps the Live Preview runtime in step with Angular's change detection. |
| `@ContentstackComponent` decorator | Marks a component so its entry/field tagging participates in Live Preview. |
| `CsEditableDirective` (`csEditable`) | Per-field edit tags — click-to-edit in the Visual Builder. |
| `CsEmptyBlockParentDirective` | Marks an empty slot/block so the Visual Builder can render an "add content" affordance where nothing is authored yet. |

---

## Wiring the directives into your templates

Import the directives into your slot/component templates to get per-field editing and empty-slot affordances:

```html
<div [csEditable]="entry | field:'title'">{{ title }}</div>
```

```html
<cx-page-slot csEmptyBlockParent position="Section1"></cx-page-slot>
```

Inline in-page editing is available via `csEditable` on custom components whenever Live Preview is enabled. For the exact directive selectors and inputs, see the source in [`src/live-preview/`](../src/live-preview) and the exports in [Live Preview / Visual Editor](api-reference.md#live-preview-visual-editor).

---

## Related

- [configuration](configuration.md) — `livePreview`, `previewToken`, `previewHost`
- [Live Preview / Visual Editor](api-reference.md#live-preview-visual-editor) — exported services, decorator, and directives
- [The two-token security model](concepts.md#the-two-token-security-model) — why the preview token is a secret
