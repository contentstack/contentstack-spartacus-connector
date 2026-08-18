import { Injectable } from '@angular/core';
import { CmsComponent, Converter } from '@spartacus/core';
import { ContentstackEntry } from '../model/contentstack.model';
import { toTypeCode } from '../model/slot-maps';
import { ContentstackFieldMapper } from './contentstack-field-mapper';
import { ContentstackCmsBannerComponentNormalizer } from './components/contentstack-cms-banner-component.normalizer';
import { ContentstackCmsNavigationComponentNormalizer } from './components/contentstack-cms-navigation-component.normalizer';
import { ContentstackCmsProductCarouselComponentNormalizer } from './components/contentstack-cms-product-carousel-component.normalizer';

/** SAP banner typecodes routed through the banner (media) normalizer. */
const BANNER_TYPE_CODES = new Set<string>([
  'SimpleResponsiveBannerComponent',
  'SimpleBannerComponent',
]);
/** SAP nav typecodes resolved via the flat-nav normalizer (`all_nodes` pool). */
const NAVIGATION_TYPE_CODES = new Set<string>([
  'CategoryNavigationComponent',
  'FooterNavigationComponent',
  'NavigationComponent',
]);

/**
 * Translates a single Contentstack entry (fetched standalone, not as part of a
 * page's slots) into a Spartacus `CmsComponent`. Used by the component
 * adapter's `load` / `findComponentsByIds` paths — e.g. when Spartacus requests
 * a shared/reusable component by uid outside the current page payload.
 *
 * `typeCode` maps the entry's content-type uid to its SAP typecode (via
 * `toTypeCode`, identity fallback for custom types) so `CmsConfig.cmsComponents`
 * resolves it to the right Angular component — consistent with the page path.
 *
 * After building the base shape, composes the component-specific normalizers
 * (banner/navigation/product-carousel) by direct method call, keyed off the
 * resolved typecode — never via the shared `CMS_COMPONENT_NORMALIZER`
 * multi-token, so OCC's own component normalizer never runs over Contentstack
 * JSON.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsComponentNormalizer implements Converter<
  ContentstackEntry,
  CmsComponent
> {
  constructor(
    protected bannerNormalizer: ContentstackCmsBannerComponentNormalizer,
    protected navigationNormalizer: ContentstackCmsNavigationComponentNormalizer,
    protected productCarouselNormalizer: ContentstackCmsProductCarouselComponentNormalizer,
    protected fieldMapper: ContentstackFieldMapper,
  ) {}

  convert(source: ContentstackEntry, target: CmsComponent = {}): CmsComponent {
    const {
      uid,
      _content_type_uid,
      _version,
      created_at,
      updated_at,
      publish_details,
      locale,
      ...fields
    } = source;

    const typeCode = toTypeCode(_content_type_uid);
    const component = {
      ...target,
      uid,
      typeCode,
      modifiedTime: updated_at ? new Date(updated_at) : undefined,
      // Map Contentstack's snake_case fields to the camelCase names the stock
      // Spartacus components read (link_name→linkName, url_link→urlLink, …).
      // Contentstack field uids must be lowercase, so this mapping is required
      // — a raw passthrough leaves e.g. links without a visible label.
      ...this.fieldMapper.map(typeCode, fields),
    } as CmsComponent;

    if (BANNER_TYPE_CODES.has(typeCode)) {
      return this.bannerNormalizer.convert(source, component);
    }
    if (NAVIGATION_TYPE_CODES.has(typeCode)) {
      return this.navigationNormalizer.convert(source, component);
    }
    if (typeCode === 'ProductCarouselComponent') {
      return this.productCarouselNormalizer.convert(source, component);
    }
    return component;
  }
}
