import { Injectable } from '@angular/core';
import { ContentstackConfig } from '../../config/contentstack-config';
import { ContentstackEntry } from '../model/contentstack.model';
import { ContentstackCurrentUser } from './contentstack-current-user';

/**
 * Presentation-level content gating (see `ContentstackConfig.accessControl`).
 *
 * Stateless by design: permissions are derived on demand and threaded through
 * the call sites (adapters/normalizer), never stored on the service — so there's
 * no shared mutable per-user state to go stale between requests.
 *
 * NOT a security boundary — gated entries are still fetched over the network and
 * dropped before render (see the config JSDoc).
 */
@Injectable({ providedIn: 'root' })
export class ContentstackRestrictionsService {
  constructor(protected config: ContentstackConfig) {}

  /** Whether gating is switched on (`accessControl.enabled`). */
  enabled(): boolean {
    return this.config.contentstack?.accessControl?.enabled === true;
  }

  /**
   * The permission tokens a user holds: `{ anonymousToken }` when anonymous,
   * else `{ loginToken, ...roles.map(rolePrefix + role) }`. Pure; never throws on
   * a missing `roles` (a logged-in user with no roles simply holds `loginToken`).
   */
  getPermissions(user: ContentstackCurrentUser | undefined): Set<string> {
    const ac = this.config.contentstack?.accessControl;
    const anonymousToken = ac?.anonymousToken ?? '_require-anonymous';
    const loginToken = ac?.loginToken ?? '_require-login';
    const rolePrefix = ac?.rolePrefix ?? '_require-';
    if (!user) {
      return new Set([anonymousToken]);
    }
    const permissions = new Set<string>([loginToken]);
    for (const role of user.roles ?? []) {
      permissions.add(`${rolePrefix}${role}`);
    }
    return permissions;
  }

  /**
   * Whether an entry is visible to a user holding `permissions`. An entry with no
   * tokens in `accessField` (absent/empty/non-array) is public. Otherwise every
   * token on the entry that starts with `rolePrefix` must be present in
   * `permissions`; tokens not matching the prefix are ignored.
   */
  isEntryAccessible(entry: ContentstackEntry, permissions: Set<string>): boolean {
    const ac = this.config.contentstack?.accessControl;
    const accessField = ac?.accessField ?? 'access_tags';
    const rolePrefix = ac?.rolePrefix ?? '_require-';
    const raw = entry[accessField];
    if (!Array.isArray(raw) || !raw.length) {
      return true;
    }
    const tokens = raw.filter((t): t is string => typeof t === 'string');
    return !tokens.some((token) => token.startsWith(rolePrefix) && !permissions.has(token));
  }
}
