/**
 * Framework-free link helpers for {@link ContentstackEditableParagraphComponent}.
 *
 * The component renders author HTML through Angular's sanitizer (never
 * `bypassSecurityTrustHtml`), which strips `id` attributes. These helpers let it
 * restore what the stock Spartacus `ParagraphComponent` gave authors without
 * bypassing the sanitizer: in-app routing for internal links, hash anchors that
 * stay on the page, and anchor targets generated for headings.
 */

export type ParagraphLinkAction = { kind: 'internal'; url: string } | { kind: 'hash'; id: string };

/**
 * Classifies an authored `href`. Returns `null` for anything the browser should
 * handle itself (absolute URLs, `//host`, `mailto:`, `tel:`, `unsafe:`, empty).
 */
export function classifyParagraphHref(href: string | null | undefined): ParagraphLinkAction | null {
  const value = (href ?? '').trim();
  if (!value) {
    return null;
  }
  if (value.startsWith('#')) {
    const id = decodeURIComponent(value.slice(1));
    return id ? { kind: 'hash', id } : null;
  }
  if (value.startsWith('/') && !value.startsWith('//')) {
    return { kind: 'internal', url: value };
  }
  return null;
}

/** Lower-case, hyphenated slug of a heading's text (`"Our Details!"` -> `"our-details"`). */
export function slugifyHeading(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Anchor ids for a list of heading texts, in order. Empty slugs get `null`
 * (no id); repeated slugs get `-2`, `-3`, ... so every generated id is unique.
 */
export function headingAnchorIds(texts: readonly string[]): (string | null)[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const slug = slugifyHeading(text);
    if (!slug) {
      return null;
    }
    const count = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, count);
    return count === 1 ? slug : `${slug}-${count}`;
  });
}
