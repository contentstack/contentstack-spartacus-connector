/**
 * Visual Builder → Spartacus language sync (DX-27690).
 *
 * Visual Builder tells the storefront which locale the editor is working in two
 * ways: a `locale` query param when it loads the iframe, and a `get-locale`
 * post-message when the editor switches locale. Both carry a Contentstack locale
 * (`de-de`); Spartacus needs its site language isocode (`de`). These helpers are
 * pure so they're unit-testable without a browser.
 */

/** Envelope `@contentstack/advanced-post-message` wraps every Visual Builder message in. */
interface VbMessage {
  eventManager?: string;
  channel?: string;
  type?: string;
  payload?: { locale?: unknown };
}

/**
 * Map a Contentstack locale back to the Spartacus language isocode, using the
 * connector's `localeMapping` (isocode → Contentstack locale) in reverse.
 * Unmapped locales fall back to the locale itself when it is a known language,
 * then to its language part (`de-de` → `de`) when that is.
 */
export function toSiteLanguage(
  csLocale: string,
  localeMapping: Record<string, string> | undefined,
  knownLanguages?: readonly string[],
): string | undefined {
  if (!csLocale) {
    return undefined;
  }
  const wanted = csLocale.toLowerCase();
  for (const [iso, mapped] of Object.entries(localeMapping ?? {})) {
    if (mapped.toLowerCase() === wanted) {
      return iso;
    }
  }
  const known = (iso: string) => !knownLanguages || knownLanguages.includes(iso);
  if (known(csLocale)) {
    return csLocale;
  }
  const base = wanted.split('-')[0];
  return base && known(base) ? base : undefined;
}

/** The locale from a Visual Builder `get-locale` message, or undefined for any other message. */
export function vbLocaleFromMessage(data: unknown): string | undefined {
  const msg = data as VbMessage | null;
  if (
    !msg ||
    msg.eventManager !== 'contentstack-adv-post-message' ||
    msg.channel !== 'visual-builder' ||
    msg.type !== 'get-locale'
  ) {
    return undefined;
  }
  const locale = msg.payload?.locale;
  return typeof locale === 'string' && locale ? locale : undefined;
}

/** The `locale` query param Visual Builder adds when it loads the storefront. */
export function vbLocaleFromUrl(search: string): string | undefined {
  return new URLSearchParams(search).get('locale') || undefined;
}
