import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * The minimal current-user shape the connector needs for content gating — just
 * the role ids. Deliberately NOT `@spartacus/core`'s `User`: keeping it local
 * means the connector imports nothing from `@spartacus/user`, so role-level
 * gating stays a genuinely optional, app-wired capability (no forced dependency,
 * no bundle-coupling if the host app doesn't have the User feature).
 */
export interface ContentstackCurrentUser {
  /** Role identifiers (e.g. SAP B2B group ids like `b2badmingroup`). */
  roles?: string[];
}

/**
 * Source of the current user for {@link ContentstackRestrictionsService} gating.
 *
 * The feature module provides a **core-only default** (login-state → anonymous
 * vs. logged-in, no roles) so gating works out of the box for the
 * anonymous/login distinction. To enable **role-level** gating, the app — which
 * already has `@spartacus/user` — overrides this token to emit the real user:
 *
 * ```ts
 * import { UserAccountFacade } from '@spartacus/user/account/root';
 * { provide: CONTENTSTACK_CURRENT_USER, useFactory: (u: UserAccountFacade) => u.get(), deps: [UserAccountFacade] }
 * ```
 *
 * `User` is structurally assignable to {@link ContentstackCurrentUser} (both
 * carry `roles?: string[]`), so that one-line factory type-checks with no cast.
 */
export const CONTENTSTACK_CURRENT_USER = new InjectionToken<
  Observable<ContentstackCurrentUser | undefined>
>('CONTENTSTACK_CURRENT_USER');
