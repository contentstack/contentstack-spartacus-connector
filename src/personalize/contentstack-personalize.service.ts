import { Inject, Injectable, Optional } from '@angular/core';
import { ContentstackConfig } from '../config/contentstack-config';

/**
 * Injection seam for Contentstack Personalize variant delivery.
 *
 * The connector stays personalization-SDK-agnostic: on every CMS page/component
 * fetch it asks this service *"which variant aliases apply to the current
 * shopper?"* and threads the answer into the Delivery API query
 * (`.variants(...)`), so Contentstack returns the composite (personalized)
 * entry. The default implementation reads a **static** list from
 * `contentstack.personalize.variantAliases` (config) — handy for a first demo
 * or test with no SDK — and returns `[]` when unset, so the connector behaves
 * exactly as before until personalization is wired.
 *
 * To drive it from real per-shopper decisions, an app **overrides** this class
 * with one backed by the Personalize Edge SDK:
 *
 * ```ts
 * @Injectable()
 * class SdkPersonalizeService extends ContentstackPersonalizeService {
 *   // resolve the manifest at SSR request start / app init, cache the aliases,
 *   // and return them here (Personalize.getVariantAliases()).
 *   override getVariantAliases(): string[] { return this.cachedAliases; }
 * }
 * // provide it AFTER ContentstackCmsFeatureModule so it wins:
 * { provide: ContentstackPersonalizeService, useClass: SdkPersonalizeService }
 * ```
 *
 * Alias format (Contentstack Personalize):
 * `cs_personalize_{experienceShortUid}_{variantShortUid}` — e.g.
 * `cs_personalize_0_0`.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackPersonalizeService {
  constructor(
    @Optional() @Inject(ContentstackConfig) protected config?: ContentstackConfig,
  ) {}

  /**
   * Variant aliases for the current shopper, passed to the Delivery API so it
   * returns the composite (personalized) entry. Empty ⇒ no personalization
   * (the base entry is served, and caching/behaviour are unchanged).
   *
   * Read synchronously on every fetch. An SDK-backed override should resolve the
   * user manifest earlier (SSR request start / app init) and return the cached
   * aliases here rather than doing async work per call.
   */
  getVariantAliases(): string[] {
    return this.config?.contentstack?.personalize?.variantAliases ?? [];
  }
}
