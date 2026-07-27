import { addEditableTags, type EntryModel } from '@contentstack/utils';

/** Minimal shape needed to tag a Contentstack entry tree for Live Preview. */
interface TaggableEntry {
  uid?: unknown;
  _content_type_uid?: unknown;
  [field: string]: unknown;
}

/**
 * Attaches Contentstack Live Preview (CSLP) edit tags to a fetched entry and
 * every resolved child entry nested inside it, each with ITS OWN content type.
 *
 * `addEditableTags` (from `@contentstack/utils`) mutates an entry in place,
 * adding a `$` map of per-field `data-cslp` values. It tags one entry's field
 * tree against a single content type, so nested REFERENCED entries (which have
 * their own uid + content type) must be re-tagged individually — otherwise a
 * clicked component would resolve to the parent page's entry, not the
 * component's. We tag the root first, then walk and re-tag each nested entry
 * (has `uid` + `_content_type_uid`) with its own content type, so the deepest
 * (correct) tagging wins.
 *
 * Pure and framework-free (only depends on `@contentstack/utils`), so the
 * client service can call it guarded by the `delivery.livePreview` flag and it
 * stays unit-testable in isolation.
 */
export function tagEntryTree(entry: TaggableEntry, contentTypeUid: string, locale = 'en-us'): void {
  addEditableTags(entry as unknown as EntryModel, contentTypeUid, true, locale);
  tagChildren(entry, locale);
}

function tagChildren(node: TaggableEntry, locale: string): void {
  for (const value of Object.values(node)) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (item && typeof item === 'object') {
        const child = item as TaggableEntry;
        if (typeof child.uid === 'string' && typeof child._content_type_uid === 'string') {
          addEditableTags(child as unknown as EntryModel, child._content_type_uid, true, locale);
          tagChildren(child, locale);
        }
      }
    }
  }
}
