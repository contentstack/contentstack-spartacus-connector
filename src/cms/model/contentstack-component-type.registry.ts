import { Injectable } from '@angular/core';

/**
 * Learns the real Contentstack content-type uid of each component entry the
 * connector fetches (from page / global-slots payloads), keyed by entry uid.
 *
 * WHY: the component adapter can only fetch a standalone component under the
 * single configured `componentContentType`. When Spartacus's `clearCmsState`
 * meta-reducer wipes the CMS store on a language/currency/login change and
 * redispatches a per-uid reload for EVERY mounted component, any component of a
 * different Contentstack type (a banner, a carousel) misses that single-type
 * fetch and would otherwise be answered with a stale `{ uid }` shell — leaving
 * the previous locale's data (e.g. its image) in the store. This registry lets
 * the adapter look up a uid's ACTUAL content type and re-fetch it in the active
 * locale instead.
 *
 * A content type is locale-invariant, so a uid learned in ONE locale resolves
 * correctly in every other — the mapping recorded on the initial page load stays
 * valid for later language switches. It lives outside the NgRx store, so it
 * survives the `clearCmsState` wipe.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackComponentTypeRegistry {
  private readonly uidToType = new Map<string, string>();

  /** Record a uid → content-type uid mapping. No-op if either value is missing. */
  record(uid: string | undefined, contentTypeUid: string | undefined): void {
    if (uid && contentTypeUid) {
      this.uidToType.set(uid, contentTypeUid);
    }
  }

  /** The learned content-type uid for a component uid, or `undefined` if unseen. */
  get(uid: string): string | undefined {
    return this.uidToType.get(uid);
  }
}
