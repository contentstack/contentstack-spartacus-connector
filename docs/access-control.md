---
title: "Access Control"
product: spartacus-connector
type: reference
tags: [spartacus-connector, access-control, content-gating]
last_updated: "2026-09-09"
---

# Access Control

Presentation-level, **opt-in** content gating. Editorial component types and the per-route page types (`landing_page`, `content_page`) carry an optional multi-value text field **`access_tags`** that gates who *sees* an entry. Off unless the storefront turns it on. Implemented in [`src/cms/access/`](../src/cms/access).

> [!WARNING]
> **Not a security boundary.** Gated entries are still fetched from the Delivery API (the delivery token ships in the client bundle) — a determined user can read them via the API / devtools. Use it to tailor what the UI shows, **not** to protect confidential data.

---

## Token convention

Values you put in `access_tags` (empty = visible to everyone):

| Token | Effect |
|---|---|
| `_require-login` | Hidden from anonymous visitors. |
| `_require-anonymous` | Hidden once the user logs in. |
| `_require-<roleGroupId>` | Visible only to users in that SAP role group, e.g. `_require-b2badmingroup` (the id must match the SAP group exactly). |

An entry is shown only if the user holds **every** `_require-*` token on it. Tokens not starting with the role prefix are ignored (so editorial tags don't gate anything).

---

## Turning it on

```ts
provideConfig(<ContentstackConfig>{
  contentstack: { accessControl: { enabled: true } },
});
```

Anonymous-vs-login gating works with no further wiring.

### Role-level gating

Role gating additionally needs the app to point the connector at the logged-in user (the connector deliberately doesn't depend on `@spartacus/user`):

```ts
import { UserAccountFacade } from '@spartacus/user/account/root';
import { CONTENTSTACK_CURRENT_USER } from '@contentstack/contentstack-spartacus-connector';

{
  provide: CONTENTSTACK_CURRENT_USER,
  useFactory: (u: UserAccountFacade) => u.get(),
  deps: [UserAccountFacade],
}
```

---

## Options

Defaults are configurable on `contentstack.accessControl` (see [contentstack.accessControl — opt-in content gating](configuration.md#contentstackaccesscontrol-opt-in-content-gating)):

| Option | Default |
|---|---|
| `enabled` | `false` |
| `accessField` | `access_tags` |
| `anonymousToken` | `_require-anonymous` |
| `loginToken` | `_require-login` |
| `rolePrefix` | `_require-` |
| `gateSharedSlugPages` | `false` |

Shared-slug product/category pages are not gated by default (`gateSharedSlugPages: false`), and the global shell (header/footer/nav) is **never** gated.

---

## SSR caching caveat

With gating on, the connector filters restricted content out of the SSR payload *before* it is written (so a user's page source only contains what they may see), and the Contentstack SSR cache key is scoped per permission set.

> [!WARNING]
> If you put a **shared** cache (CDN / SSR cache) in front of the app, you must still send `Cache-Control: private` (or `Vary` on the identity that drives permissions) for gated routes, so one audience's rendered page is never served to another.

---

## Related

- [content-model](content-model.md) — the `access_tags` field on component and page types (§ content gating)
- [configuration](configuration.md) — the `accessControl` option block
- [Access control](api-reference.md#access-control) — `CONTENTSTACK_CURRENT_USER`, `ContentstackRestrictionsService`
- Repository doc: [`CONTENT-MODEL.md` §4.5](../CONTENT-MODEL.md)
