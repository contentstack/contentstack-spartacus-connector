/*
 * Type guards for narrowing the raw, loosely-typed Contentstack Delivery API
 * shapes (`contentstack.model.ts`) down to the specific entry/field shapes the
 * component-specific normalizers need.
 */

import { ContentstackEntry, ContentstackFile, ContentstackReference } from './contentstack.model';

export function isString(field: unknown): field is string {
  return typeof field === 'string';
}

/**
 * Distinguishes a fully-resolved Contentstack entry from an unresolved
 * reference pointer. An unresolved reference is exactly `{ uid, _content_type_uid? }`;
 * a resolved entry additionally carries system fields such as `created_at`,
 * which Contentstack only populates once the reference has actually been
 * expanded (`includeReference`/`.locale()`).
 */
export function isResolvedEntry<T extends ContentstackEntry = ContentstackEntry>(
  field: ContentstackReference | undefined | null,
): field is T {
  return !!field && typeof field === 'object' && isString((field as ContentstackEntry).created_at);
}

export function isMediaContainer(
  field: ContentstackReference | undefined | null,
): field is ContentstackEntry {
  return isResolvedEntry(field) && field._content_type_uid === 'media_container';
}

/**
 * Contentstack file fields are delivered inline on the entry (`{url, filename,
 * content_type}`), never as a separately-linked entry — so this checks field
 * shape rather than a content-type uid, unlike the guards above.
 */
export function isContentstackFile(field: unknown): field is ContentstackFile {
  return (
    !!field &&
    typeof field === 'object' &&
    isString((field as ContentstackFile).url) &&
    isString((field as ContentstackFile).filename) &&
    isString((field as ContentstackFile).content_type)
  );
}
