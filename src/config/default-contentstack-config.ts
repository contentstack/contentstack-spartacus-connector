import { Region } from '@contentstack/delivery-sdk';
import { ContentstackConfig } from './contentstack-config';
import { PAGE_REFERENCE_FIELDS } from '../cms/model/slot-maps';

/**
 * Sensible defaults for the Contentstack feature. Credentials are intentionally
 * left blank — the consuming app must provide `apiKey` / `deliveryToken` /
 * `environment` via its own `provideConfig(<ContentstackConfig>{ ... })`.
 *
 * Provided with `provideDefaultConfig` in {@link ContentstackCmsFeatureModule},
 * so any app-level `provideConfig` deep-merges over these values.
 *
 * `includeReferences` defaults to every `cms_page` slot + header/footer field
 * (from `slot-maps.ts`), so a single page fetch resolves all component entries
 * inline — the page normalizer then emits them into the CMS store without a
 * second round-trip through the component adapter.
 */
export const defaultContentstackConfig: ContentstackConfig = {
  contentstack: {
    delivery: {
      apiKey: '',
      deliveryToken: '',
      environment: '',
      region: Region.US,
      branch: 'main',
      livePreview: false,
    },
    slugField: 'url',
    occFallback: true,
    includeFallback: false,
    cmsPageContentType: 'cms_page',
    includeReferences: [...PAGE_REFERENCE_FIELDS],
    timeoutMs: 10000,
  },
};
