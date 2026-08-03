import {
  Inject,
  Injectable,
  PLATFORM_ID,
  StateKey,
  TransferState,
  makeStateKey,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Observable, defer, from, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import contentstack, { QueryOperation, Region, type Stack } from '@contentstack/delivery-sdk';
import { LoggerService } from '@spartacus/core';
import { ContentstackConfig } from '../config/contentstack-config';
import { tagEntryTree } from '../live-preview/tag-entry-tree';
import { ContentstackCmsPageEntry, ContentstackEntry } from '../cms/model/contentstack.model';

/**
 * The single seam between this library and Contentstack. Every network call to
 * the Delivery API goes through here, which lets us own three concerns in one
 * place:
 *
 *  1. **Auth + region** — builds the `@contentstack/delivery-sdk` stack once
 *     from `ContentstackConfig`.
 *  2. **SSR** — wraps each fetch in Angular `TransferState`, so content fetched
 *     during server-side rendering is serialized into the page and the browser
 *     does not re-fetch it on hydration (the one thing a third-party SDK loses
 *     versus Spartacus's native HttpClient — reclaimed here).
 *  3. **Resilience** — applies the configured timeout and converts failures to
 *     an empty result, so a slow/unreachable CMS never hangs the storefront.
 *
 * Adapters depend on this service, never on the SDK directly.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackClientService {
  private _stack?: Stack;

  constructor(
    protected config: ContentstackConfig,
    protected transferState: TransferState,
    protected logger: LoggerService,
    @Inject(PLATFORM_ID) protected platformId: object,
  ) {}

  /** Lazily build (and memoize) the Delivery SDK stack from config. */
  protected get stack(): Stack {
    if (this._stack) {
      return this._stack;
    }
    const delivery = this.config.contentstack?.delivery;
    if (!delivery?.apiKey || !delivery?.deliveryToken || !delivery?.environment) {
      throw new Error(
        '[ContentstackClientService] Missing Contentstack delivery credentials. ' +
          'Provide contentstack.delivery.{apiKey,deliveryToken,environment} via provideConfig().',
      );
    }
    this._stack = contentstack.stack({
      apiKey: delivery.apiKey,
      deliveryToken: delivery.deliveryToken,
      environment: delivery.environment,
      region: delivery.region ?? Region.US,
      ...(delivery.branch ? { branch: delivery.branch } : {}),
      // Live Preview: when enabled, route through the preview host with
      // the preview token so draft content resolves. The Live Preview SDK
      // (passed this same stack as `stackSdk`) keeps `live_preview` (the hash)
      // in sync per edit, so queries pick up the entry being edited.
      ...(delivery.livePreview && delivery.previewToken
        ? {
            live_preview: {
              enable: true,
              preview_token: delivery.previewToken,
              host: delivery.previewHost ?? 'rest-preview.contentstack.com',
            },
          }
        : {}),
    });
    return this._stack;
  }

  /**
   * The underlying Delivery SDK stack instance.
   */
  get sdkStack(): Stack {
    return this.stack;
  }

  /**
   * Apply the current Live Preview hash to the delivery stack so the next
   * query resolves the draft of the entry being edited in Visual Builder
   * (delivery-sdk v4 `livePreviewQuery`). No-op without a hash, so normal
   * browsing keeps hitting the published CDN.
   */
  applyLivePreviewHash(hash: string | undefined): void {
    if (!hash) {
      return;
    }
    // `livePreviewQuery` exists on the delivery-sdk v4 Stack at runtime; access
    // it defensively so the type stays resilient across SDK minor versions.
    const stack = this.stack as unknown as {
      livePreviewQuery?: (query: { live_preview: string }) => void;
    };
    stack.livePreviewQuery?.({ live_preview: hash });
  }

  protected get timeoutMs(): number {
    return this.config.contentstack?.timeoutMs ?? 10000;
  }

  /**
   * Whether Delivery API queries should request master-locale fallback for
   * entries that aren't localized in the active locale (`include_fallback`).
   * Only meaningful when a locale is actually resolved; see {@link resolveLocale}.
   */
  protected get includeFallback(): boolean {
    return this.config.contentstack?.includeFallback ?? false;
  }

  /**
   * Resolve a Spartacus site-language isocode (e.g. `en`) to the Contentstack
   * locale content is authored in (e.g. `en-us`) via `localeMapping`. Identity
   * fallback for unmapped codes; `undefined` in → `undefined` out (no `.locale()`
   * applied, so the stack serves its master locale — the pre-locale behavior).
   */
  protected resolveLocale(locale?: string): string | undefined {
    if (!locale) {
      return undefined;
    }
    return this.config.contentstack?.localeMapping?.[locale] ?? locale;
  }

  /**
   * Fetch a single CMS page entry by its URL slug.
   *
   * @param contentTypeUid the CMS page content type uid
   * @param slugField      the field holding the URL slug
   * @param slug           the route slug to match
   * @param includeRefs    reference fields to expand in the same call
   * @param locale         the active locale to resolve content in (optional)
   */
  getPageBySlug(
    contentTypeUid: string,
    slugField: string,
    slug: string,
    includeRefs: string[] = [],
    locale?: string,
  ): Observable<ContentstackCmsPageEntry | undefined> {
    const csLocale = this.resolveLocale(locale);
    const key = makeStateKey<ContentstackCmsPageEntry | undefined>(
      `cs-page:${contentTypeUid}:${slugField}:${slug}:${csLocale ?? '*'}`,
    );
    return this.withTransferState(key, () => {
      // `includeReference` lives on the Entries object (from `.entry()`), not on
      // the Query (from `.query()`), so apply it before building the query.
      let entries = this.stack.contentType(contentTypeUid).entry();
      if (includeRefs.length) {
        entries = entries.includeReference(includeRefs);
      }
      if (csLocale) {
        entries = entries.locale(csLocale);
        if (this.includeFallback) {
          entries = entries.includeFallback();
        }
      }
      return entries
        .query()
        .where(slugField, QueryOperation.EQUALS, slug)
        .find<ContentstackCmsPageEntry>()
        .then((res) => {
          const entry = res?.entries?.[0];
          if (entry && this.config.contentstack?.delivery?.livePreview) {
            this.tagForLivePreview(entry, contentTypeUid);
          }
          return entry;
        });
    });
  }

  /**
   * Fetch the shared "global slots" entry (header/footer/navigation shell) that
   * is merged into every page. Loads the entry with the given `title`, or the
   * first entry of the content type when no title is given (singleton case).
   */
  getGlobalSlots(
    contentTypeUid: string,
    title?: string,
    includeRefs: string[] = [],
    locale?: string,
  ): Observable<ContentstackCmsPageEntry | undefined> {
    const csLocale = this.resolveLocale(locale);
    const key = makeStateKey<ContentstackCmsPageEntry | undefined>(
      `cs-global:${contentTypeUid}:${title ?? '*'}:${csLocale ?? '*'}`,
    );
    return this.withTransferState(key, () => {
      // Resolve the shell's component references inline (same as the page path),
      // else header/footer/nav components arrive as bare uid refs with no content.
      let entries = this.stack.contentType(contentTypeUid).entry();
      if (includeRefs.length) {
        entries = entries.includeReference(includeRefs);
      }
      if (csLocale) {
        entries = entries.locale(csLocale);
        if (this.includeFallback) {
          entries = entries.includeFallback();
        }
      }
      const query = entries.query();
      if (title) {
        query.where('title', QueryOperation.EQUALS, title);
      }
      return query.find<ContentstackCmsPageEntry>().then((res) => {
        const entry = res?.entries?.[0];
        if (entry && this.config.contentstack?.delivery?.livePreview) {
          this.tagForLivePreview(entry, contentTypeUid);
        }
        return entry;
      });
    });
  }
  /*
   * Attach Contentstack Live Preview (CSLP) edit tags to a fetched page and its
   * resolved component entries (delegated to the pure {@link tagEntryTree}
   * helper), so Visual Builder can map on-page elements back to their entries
   * (component-to-entry navigation) and `csEditable` can bind per-field
   * `data-cslp` attributes. Only invoked when `delivery.livePreview` is on, so
   * pure delivery builds are untouched.
   */
  protected tagForLivePreview(entry: ContentstackCmsPageEntry, contentTypeUid: string): void {
    tagEntryTree(entry, contentTypeUid, entry.locale ?? 'en-us');
  }

  /** Fetch a single component/module entry by uid. */
  getEntryByUid(
    contentTypeUid: string,
    uid: string,
    locale?: string,
  ): Observable<ContentstackEntry | undefined> {
    const csLocale = this.resolveLocale(locale);
    const key = makeStateKey<ContentstackEntry | undefined>(
      `cs-entry:${contentTypeUid}:${uid}:${csLocale ?? '*'}`,
    );
    return this.withTransferState(key, () => {
      let entry = this.stack.contentType(contentTypeUid).entry(uid);
      if (csLocale) {
        entry = entry.locale(csLocale);
        if (this.includeFallback) {
          entry = entry.includeFallback();
        }
      }
      return entry.fetch<ContentstackEntry>().then((e) => e ?? undefined);
    });
  }

  /** Fetch multiple component/module entries of one content type by their uids. */
  getEntriesByUids(
    contentTypeUid: string,
    uids: string[],
    locale?: string,
  ): Observable<ContentstackEntry[]> {
    if (!uids.length) {
      return of([]);
    }
    const csLocale = this.resolveLocale(locale);
    const key = makeStateKey<ContentstackEntry[]>(
      `cs-entries:${contentTypeUid}:${[...uids].sort().join(',')}:${csLocale ?? '*'}`,
    );
    return this.withTransferState(key, () => {
      let entries = this.stack.contentType(contentTypeUid).entry();
      if (csLocale) {
        entries = entries.locale(csLocale);
        if (this.includeFallback) {
          entries = entries.includeFallback();
        }
      }
      return entries
        .query()
        .where('uid', QueryOperation.INCLUDES, uids)
        .find<ContentstackEntry>()
        .then((res) => res?.entries ?? []);
    });
  }

  /**
   * Wrap a Delivery API call in TransferState + timeout + failure fallback.
   *
   * On the browser, if the server already stored a result under `key`, it is
   * replayed from the DOM and the network is not touched. On the server, the
   * result is written into TransferState for the browser to pick up. The `defer`
   * ensures the SDK promise is created per-subscription, not eagerly.
   */
  protected withTransferState<T>(
    key: StateKey<T>,
    factory: () => Promise<T>,
    fallback?: T,
  ): Observable<T> {
    if (this.transferState.hasKey(key)) {
      const cached = this.transferState.get<T>(key, fallback as T);
      // Consume once on the browser so subsequent navigations fetch fresh.
      this.transferState.remove(key);
      return of(cached);
    }
    const isServer = isPlatformServer(this.platformId);
    return defer(() => from(factory())).pipe(
      timeout(this.timeoutMs),
      catchError((error) => {
        this.logger.error('[ContentstackClientService] Delivery API call failed', {
          key: String(key),
          error,
        });
        return of(fallback as T);
      }),
      // Persist server-fetched results for the browser to reuse on hydration.
      // (Applied via a tap-like map to keep types tight.)
      this.persistOnServer(key, isServer),
    );
  }

  /** rxjs operator that stores the emitted value into TransferState on the server. */
  private persistOnServer<T>(key: StateKey<T>, isServer: boolean) {
    return (source: Observable<T>): Observable<T> =>
      new Observable<T>((subscriber) =>
        source.subscribe({
          next: (value) => {
            if (isServer && value !== undefined) {
              this.transferState.set<T>(key, value);
            }
            subscriber.next(value);
          },
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        }),
      );
  }
}
