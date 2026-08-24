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
 * Filtering runs before the SSR TransferState write (see {@link sanitizeForTransfer}),
 * so restricted content does not ship in the server-rendered payload. It is still
 * NOT a security boundary, though — the delivery token is in the client bundle, so a
 * determined user can read gated entries directly from the Delivery API.
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

  /**
   * Produce the version of a fetched entry that is SAFE to serialize into the SSR
   * TransferState payload for a user holding `permissions`. Gating
   * used to run only at render time, so the raw entry — including restricted
   * nested components, and the entry itself when the whole page is gated — shipped
   * in the SSR HTML regardless. This filters BEFORE the payload is written:
   *
   *  - nested referenced entries the user can't access are stripped from the tree;
   *  - when `gateRoot` is true and the root entry itself is inaccessible, it is
   *    reduced to a tags-only stub ({@link redactEntry}) so none of its content
   *    reaches the browser, while downstream gating still sees it as restricted
   *    (i.e. "restricted" stays distinct from "absent").
   *
   * Operates in place on the per-request fetch result and returns the safe value.
   */
  sanitizeForTransfer<T extends ContentstackEntry>(
    entry: T,
    permissions: Set<string>,
    gateRoot: boolean,
  ): T {
    this.sanitizeNested(entry, permissions, 0);
    if (gateRoot && !this.isEntryAccessible(entry, permissions)) {
      return this.redactEntry(entry) as T;
    }
    return entry;
  }

  /**
   * Reduce a restricted entry to a tags-only stub — uid, content-type uid, and the
   * access field — dropping every content field. {@link isEntryAccessible} still
   * reports it restricted (the tags survive), but its content never leaves the
   * server. See {@link sanitizeForTransfer}.
   */
  redactEntry(entry: ContentstackEntry): ContentstackEntry {
    const accessField = this.config.contentstack?.accessControl?.accessField ?? 'access_tags';
    const stub: ContentstackEntry = { uid: entry.uid };
    if (entry._content_type_uid !== undefined) {
      stub._content_type_uid = entry._content_type_uid;
    }
    if (entry[accessField] !== undefined) {
      stub[accessField] = entry[accessField];
    }
    return stub;
  }

  /**
   * A stable, per-audience fragment appended to Contentstack TransferState cache
   * keys when gating is on, so a payload filtered for one permission set is never
   * replayed to (or CDN-cached for) a different audience. Empty when gating is off
   * — keys and behavior are then byte-for-byte identical to before.
   */
  cacheKeySuffix(permissions?: Set<string>): string {
    if (!permissions || !permissions.size) {
      return '';
    }
    return `:acl=${[...permissions].sort().join('|')}`;
  }

  /** Whether a value is a Contentstack entry node (an object carrying a string uid). */
  protected isEntryLike(value: unknown): value is ContentstackEntry {
    return (
      !!value && typeof value === 'object' && typeof (value as { uid?: unknown }).uid === 'string'
    );
  }

  /**
   * Recursively strip inaccessible referenced entries from an entry's fields.
   * Restricted nodes are dropped from reference arrays and deleted from single-
   * reference fields; accessible (incl. untagged/public) nodes are recursed into.
   * Depth-guarded against pathological/cyclic payloads.
   */
  protected sanitizeNested(value: unknown, permissions: Set<string>, depth: number): void {
    if (depth > 12 || value == null || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) {
        const item = value[i];
        if (this.isEntryLike(item) && !this.isEntryAccessible(item, permissions)) {
          value.splice(i, 1);
          continue;
        }
        this.sanitizeNested(item, permissions, depth + 1);
      }
      return;
    }
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (this.isEntryLike(child) && !this.isEntryAccessible(child, permissions)) {
        delete obj[key];
        continue;
      }
      this.sanitizeNested(child, permissions, depth + 1);
    }
  }
}
