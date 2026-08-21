import { Inject, Injectable, Optional } from '@angular/core';
import { Observable, combineLatest, forkJoin, of } from 'rxjs';
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
import { ContentstackComponentTypeRegistry } from '../model/contentstack-component-type.registry';
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
    protected typeRegistry: ContentstackComponentTypeRegistry,
    // Optional — see the page adapter: absent source ⇒ anonymous, not a DI error.
    @Optional()
    @Inject(CONTENTSTACK_CURRENT_USER)
    protected currentUser$: Observable<ContentstackCurrentUser | undefined> | null = null,
  ) {}

  /**
   * The Contentstack content type to fetch a component uid under: the type
   * LEARNED from a page/global payload (so a banner/carousel resolves as its own
   * type, not the single configured default), falling back to the configured
   * `componentContentType`. `undefined` when neither is known.
   */
  protected resolveType(id: string): string | undefined {
    return this.typeRegistry.get(id) ?? this.componentContentType();
  }

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
    // Resolve the fetch type UP FRONT: a learned type (e.g. a banner's own
    // content type, recorded when it arrived in a page payload) wins over the
    // single configured `componentContentType`, so a per-uid reload — the one
    // Spartacus fires for every mounted component on a language switch —
    // re-fetches the component as ITS type in the active locale instead of
    // missing and returning a stale shell.
    const contentType = this.resolveType(id);
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
        (permissions
          ? this.client.getEntryByUid(contentType, id, locale, { permissions, gateRoot: true })
          : this.client.getEntryByUid(contentType, id, locale)
        ).pipe(
          switchMap((entry: ContentstackEntry | undefined) => {
            if (entry) {
              // Restricted → a bare shell, NOT the OCC fallback: a gated
              // Contentstack entry must not silently render its OCC twin.
              if (permissions && !this.restrictions.isEntryAccessible(entry, permissions)) {
                return of({ uid: id } as T);
              }
              return of(this.normalizer.convert(entry) as T);
            }
            // Still not found — an unlearned Contentstack-native uid that also
            // isn't under `componentContentType` belongs to some other type OCC
            // would never have. Forwarding it to OCC would fail a beat later and
            // mark the component "not found", flipping its already-subscribed
            // `data$` to `null`; several stock components (e.g. BannerComponent,
            // SearchBoxComponent) don't null-guard that and throw. A benign shell
            // is inert and safe — the component's real data already arrived via
            // the page payload and isn't lost.
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
    // Group each id by its resolved Contentstack content type (learned type wins
    // over the configured default), so a mixed reload batch — the shape
    // `clearCmsState` fires on a language switch — fetches banners as banners,
    // links as links, etc., each in the active locale. Ids with no resolvable
    // Contentstack type (nothing learned and no `componentContentType`) fall
    // through to the OCC/shell handling below.
    const byType = new Map<string, string[]>();
    for (const id of ids) {
      const type = this.resolveType(id);
      if (type) {
        const group = byType.get(type);
        if (group) {
          group.push(id);
        } else {
          byType.set(type, [id]);
        }
      }
    }
    if (byType.size === 0) {
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
        forkJoin(
          [...byType.entries()].map(([type, uids]) =>
            permissions
              ? this.client.getEntriesByUids(type, uids, locale, { permissions, gateRoot: true })
              : this.client.getEntriesByUids(type, uids, locale),
          ),
        ).pipe(
          switchMap((groups: ContentstackEntry[][]) => {
            const entries = groups.flat();
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
            // `load()`): a Contentstack-native uid not resolved here belongs to
            // another Contentstack content type and will never exist in OCC, so
            // only forward genuinely OCC-shaped ids — anything else gets a benign
            // shell instead of tripping a `LoadCmsComponentFail` that would null
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
