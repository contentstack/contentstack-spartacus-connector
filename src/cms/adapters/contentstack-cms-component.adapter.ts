import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
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
    protected occComponentAdapter: OccCmsComponentAdapter
  ) {}

  load<T extends CmsComponent>(
    id: string,
    pageContext: PageContext,
    _fields?: string
  ): Observable<T> {
    const occFallback = this.occFallback();
    const contentType = this.componentContentType();
    if (!contentType) {
      if (occFallback) {
        return this.occComponentAdapter.load<T>(id, pageContext);
      }
      this.warnNoContentType('load', [id]);
      return of({ uid: id } as T);
    }
    return this.languageService.getActive().pipe(
      switchMap((locale) =>
        this.client.getEntryByUid(contentType, id, locale).pipe(
          switchMap((entry: ContentstackEntry | undefined) => {
            if (entry) {
              return of(this.normalizer.convert(entry) as T);
            }
            // Not in Contentstack → OCC (hybrid) or a bare shell.
            return occFallback
              ? this.occComponentAdapter.load<T>(id, pageContext)
              : of({ uid: id } as T);
          })
        )
      )
    );
  }

  findComponentsByIds(
    ids: string[],
    pageContext: PageContext
  ): Observable<CmsComponent[]> {
    const occFallback = this.occFallback();
    const contentType = this.componentContentType();
    if (!contentType) {
      if (occFallback) {
        return this.occComponentAdapter.findComponentsByIds(ids, pageContext);
      }
      this.warnNoContentType('findComponentsByIds', ids);
      return of([]);
    }
    return this.languageService.getActive().pipe(
      switchMap((locale) =>
        this.client.getEntriesByUids(contentType, ids, locale).pipe(
          switchMap((entries: ContentstackEntry[]) => {
            const csComponents = entries.map((entry) =>
              this.normalizer.convert(entry)
            );
            if (!occFallback) {
              return of(csComponents);
            }
            // Serve the ids Contentstack didn't resolve from OCC, then merge.
            const found = new Set(entries.map((e) => e.uid));
            const remaining = ids.filter((id) => !found.has(id));
            if (!remaining.length) {
              return of(csComponents);
            }
            return this.occComponentAdapter
              .findComponentsByIds(remaining, pageContext)
              .pipe(map((occComponents) => [...csComponents, ...occComponents]));
          })
        )
      )
    );
  }

  protected componentContentType(): string | undefined {
    return this.config.contentstack?.componentContentType;
  }

  protected occFallback(): boolean {
    return this.config.contentstack?.occFallback ?? true;
  }

  private warnNoContentType(method: string, ids: string[]): void {
    this.logger.warn(
      `[ContentstackCmsComponentAdapter] ${method}([${ids.join(
        ', '
      )}]) called but contentstack.componentContentType is not configured and ` +
        'occFallback is disabled. Components delivered inside page payloads are ' +
        'unaffected; only standalone component lookups need this. Returning an ' +
        'empty result.'
    );
  }
}
