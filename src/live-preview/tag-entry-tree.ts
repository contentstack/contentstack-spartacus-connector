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

/**
 * Retarget a single CSLP v1 tag string at a different locale by swapping ONLY
 * its locale segment. A tag is `${contentTypeUid}.${entryUid}.${locale}[.${field}…]`
 * and a Contentstack entry's uid is the same across locales, so pointing an edit
 * tag at another language is purely a locale-segment swap. Returns the tag
 * unchanged when it has fewer than 3 segments or already matches `locale`. Pure,
 * so the language-switch retag in `ContentstackLivePreviewService` stays
 * unit-testable without a DOM.
 */
export function retargetTagLocale(tag: string, locale: string): string {
  const segments = tag.split('.');
  if (segments.length < 3 || segments[2] === locale) {
    return tag;
  }
  segments[2] = locale;
  return segments.join('.');
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
