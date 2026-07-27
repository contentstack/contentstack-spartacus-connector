import { ContentstackCmsComponentNormalizer } from './contentstack-cms-component.normalizer';
import { ContentstackCmsBannerComponentNormalizer } from './components/contentstack-cms-banner-component.normalizer';
import { ContentstackCmsNavigationComponentNormalizer } from './components/contentstack-cms-navigation-component.normalizer';
import { ContentstackCmsProductCarouselComponentNormalizer } from './components/contentstack-cms-product-carousel-component.normalizer';
import { ContentstackFieldMapper } from './contentstack-field-mapper';
import { ContentstackEntry } from '../model/contentstack.model';

describe('ContentstackCmsComponentNormalizer', () => {
  const normalizer = new ContentstackCmsComponentNormalizer(
    new ContentstackCmsBannerComponentNormalizer(),
    new ContentstackCmsNavigationComponentNormalizer(),
    new ContentstackCmsProductCarouselComponentNormalizer(),
    new ContentstackFieldMapper()
  );

  it('maps a standalone entry to a CmsComponent with typeCode from content type', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_promo_1',
      _content_type_uid: 'promo_banner',
      updated_at: '2026-07-01T10:00:00Z',
      title: 'Summer Sale',
      ctaLabel: 'Save 20%',
    };

    const component = normalizer.convert(entry);

    expect(component.uid).toBe('blt_promo_1');
    expect(component.typeCode).toBe('promo_banner');
    expect(component.modifiedTime).toEqual(new Date('2026-07-01T10:00:00Z'));
    expect((component as any).title).toBe('Summer Sale');
    expect((component as any).ctaLabel).toBe('Save 20%');
    // System fields are not leaked into the component payload.
    expect((component as any)._content_type_uid).toBeUndefined();
    expect((component as any).updated_at).toBeUndefined();
  });
});
