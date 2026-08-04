import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  CmsComponent,
  CmsComponentAdapter,
  LanguageService,
  LoggerService,
  OccCmsComponentAdapter,
  PageContext,
} from '@spartacus/core';
import { ContentstackConfig } from '../../config/contentstack-config';
import { ContentstackClientService } from '../../client/contentstack-client.service';
import { ContentstackCmsComponentNormalizer } from '../converters/contentstack-cms-component.normalizer';
import { ContentstackEntry } from '../model/contentstack.model';
import { ContentstackRestrictionsService } from '../access/contentstack-restrictions.service';
import {
  CONTENTSTACK_CURRENT_USER,
  ContentstackCurrentUser,
} from '../access/contentstack-current-user';

/**
 * Replaces Spartacus's OCC component loader (`OccCmsComponentAdapter`).
 *
 * The primary source of component data is the page payload:
 * {@link ContentstackCmsPageNormalizer} emits a flat `components[]` alongside the
 * page structure, which Spartacus loads into the CMS store directly — so this
 * adapter is only exercised when Spartacus requests a shared/reusable component
 * by uid that is *not* already in the store.
 *
 * **Hybrid fallback** (default, `occFallback: true`): a component Contentstack
 * doesn't have (or when `componentContentType` isn't configured) is served from
 * SAP via the injected {@link OccCmsComponentAdapter}, so OCC-authored
 * components render alongside Contentstack ones. With `occFallback: false` the
 * adapter returns an empty/shell result instead (full-replacement mode), and a
 * standalone lookup then requires `contentstack.componentContentType`.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsComponentAdapter implements CmsComponentAdapter {
  constructor(
    protected client: ContentstackClientService,
    protected normalizer: ContentstackCmsComponentNormalizer,
    protected config: ContentstackConfig,
    protected logger: LoggerService,
    protected languageService: LanguageService,
    protected occComponentAdapter: OccCmsComponentAdapter,
    protected restrictions: ContentstackRestrictionsService,
    // Optional — see the page adapter: absent source ⇒ anonymous, not a DI error.
    @Optional()
    @Inject(CONTENTSTACK_CURRENT_USER)
    protected currentUser$: Observable<ContentstackCurrentUser | undefined> | null = null,
  ) {}

  /** Active user's permission tokens, or `of(undefined)` when gating is off. */
  protected permissions(): Observable<Set<string> | undefined> {
    if (!this.restrictions.enabled()) {
      return of(undefined);
    }
    return (this.currentUser$ ?? of(undefined)).pipe(
      map((user) => this.restrictions.getPermissions(user)),
    );
  }

  load<T extends CmsComponent>(
    id: string,
    pageContext: PageContext,
    _fields?: string,
  ): Observable<T> {
    const occFallback = this.occFallback();
    const contentType = this.componentContentType();
    if (!contentType) {
      if (occFallback) {
        if (this.isContentstackUid(id)) {
          return of({ uid: id } as T);
        }
        return this.occComponentAdapter.load<T>(id, pageContext);
      }
      this.warnNoContentType('load', [id]);
      return of({ uid: id } as T);
    }
    return combineLatest([this.languageService.getActive(), this.permissions()]).pipe(
      switchMap(([locale, permissions]) =>
        this.client.getEntryByUid(contentType, id, locale).pipe(
          switchMap((entry: ContentstackEntry | undefined) => {
            if (entry) {
              // Restricted → a bare shell, NOT the OCC fallback: a gated
              // Contentstack entry must not silently render its OCC twin.
              if (permissions && !this.restrictions.isEntryAccessible(entry, permissions)) {
                return of({ uid: id } as T);
              }
              return of(this.normalizer.convert(entry) as T);
            }
            // Not under componentContentType. A Contentstack-native uid here
            // is a component of some OTHER Contentstack content type (e.g. a
            // banner), not one OCC would ever have — this is most commonly
            // hit when Spartacus refreshes already-mounted components after
            // a language/currency/login change (Spartacus's `clearCmsState`
            // meta-reducer wipes the CMS store on those events and
            // redispatches a per-uid reload for every mounted component,
            // regardless of its type — not just the ones this adapter
            // models). Forwarding it to OCC would only fail a beat later and
            // mark the component "not found", which flips its
            // already-subscribed `data$` to `null`; several stock components
            // (e.g. BannerComponent, SearchBoxComponent) don't null-guard
            // that and throw. A benign shell is a safe, inert result either
            // way — the component's real data already arrived via the page
            // payload and isn't lost.
            return occFallback && !this.isContentstackUid(id)
              ? this.occComponentAdapter.load<T>(id, pageContext)
              : of({ uid: id } as T);
          }),
        ),
      ),
    );
  }

  findComponentsByIds(ids: string[], pageContext: PageContext): Observable<CmsComponent[]> {
    const occFallback = this.occFallback();
    const contentType = this.componentContentType();
    if (!contentType) {
      if (occFallback) {
        const occIds = ids.filter((id) => !this.isContentstackUid(id));
        const shells = ids
          .filter((id) => this.isContentstackUid(id))
          .map((id) => ({ uid: id }) as CmsComponent);
        if (!occIds.length) {
          return of(shells);
        }
        return this.occComponentAdapter
          .findComponentsByIds(occIds, pageContext)
          .pipe(map((occComponents) => [...shells, ...occComponents]));
      }
      this.warnNoContentType('findComponentsByIds', ids);
      return of([]);
    }
    return combineLatest([this.languageService.getActive(), this.permissions()]).pipe(
      switchMap(([locale, permissions]) =>
        this.client.getEntriesByUids(contentType, ids, locale).pipe(
          switchMap((entries: ContentstackEntry[]) => {
            const accessible = permissions
              ? entries.filter((entry) => this.restrictions.isEntryAccessible(entry, permissions))
              : entries;
            const csComponents = accessible.map((entry) => this.normalizer.convert(entry));
            if (!occFallback) {
              return of(csComponents);
            }
            // Mark EVERY resolved id as found — including restricted ones — so a
            // gated entry is never treated as "missing" and re-fetched from OCC.
            const found = new Set(entries.map((e) => e.uid));
            const remaining = ids.filter((id) => !found.has(id));
            if (!remaining.length) {
              return of(csComponents);
            }
            // Split remaining ids by uid shape (see the matching comment in
            // `load()`): a Contentstack-native uid not found under
            // componentContentType belongs to another Contentstack content
            // type and will never exist in OCC, so only forward
            // genuinely OCC-shaped ids — anything else gets a benign shell
            // instead of tripping a `LoadCmsComponentFail` that would null
            // out an already-mounted component's data stream.
            const occRemaining = remaining.filter((id) => !this.isContentstackUid(id));
            const shells = remaining
              .filter((id) => this.isContentstackUid(id))
              .map((id) => ({ uid: id }) as CmsComponent);
            if (!occRemaining.length) {
              return of([...csComponents, ...shells]);
            }
            return this.occComponentAdapter
              .findComponentsByIds(occRemaining, pageContext)
              .pipe(map((occComponents) => [...csComponents, ...shells, ...occComponents]));
          }),
        ),
      ),
    );
  }

  protected componentContentType(): string | undefined {
    return this.config.contentstack?.componentContentType;
  }

  /**
   * Contentstack entry uids are always `blt<hex>` — a distinct namespace from
   * OCC's own component ids (e.g. `PowertoolsHompageSplashBannerComponent`).
   * Used to avoid forwarding a Contentstack-native uid to the OCC fallback,
   * where it can never resolve.
   */
  protected isContentstackUid(id: string): boolean {
    return id.startsWith('blt');
  }

  protected occFallback(): boolean {
    return this.config.contentstack?.occFallback ?? true;
  }

  private warnNoContentType(method: string, ids: string[]): void {
    this.logger.warn(
      `[ContentstackCmsComponentAdapter] ${method}([${ids.join(
        ', ',
      )}]) called but contentstack.componentContentType is not configured and ` +
        'occFallback is disabled. Components delivered inside page payloads are ' +
        'unaffected; only standalone component lookups need this. Returning an ' +
        'empty result.',
    );
  }
}
