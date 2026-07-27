import { ContentstackCmsProductCarouselComponentNormalizer } from './contentstack-cms-product-carousel-component.normalizer';
import { ContentstackEntry } from '../../model/contentstack.model';

describe('ContentstackCmsProductCarouselComponentNormalizer', () => {
  const normalizer = new ContentstackCmsProductCarouselComponentNormalizer();

  it('extracts SKUs from raw OCC product URLs into a space-separated productCodes string', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_carousel_1',
      _content_type_uid: 'product_carousel_component',
      created_at: '2026-01-01T00:00:00.000Z',
      products: [
        'https://api.example.com/occ/v2/electronics/products/1934793',
        'https://api.example.com/occ/v2/electronics/products/300938',
      ],
    };

    const component = normalizer.convert(entry);

    expect(component.productCodes).toBe('1934793 300938');
  });

  it('leaves productCodes undefined when products is missing or empty', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_carousel_2',
      _content_type_uid: 'product_carousel_component',
      created_at: '2026-01-01T00:00:00.000Z',
      products: [],
    };

    const component = normalizer.convert(entry);

    expect(component.productCodes).toBeUndefined();
  });

  it('ignores non-string entries in the products array', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_carousel_3',
      _content_type_uid: 'product_carousel_component',
      created_at: '2026-01-01T00:00:00.000Z',
      products: ['https://api.example.com/occ/v2/electronics/products/1934793', null, 42],
    };

    const component = normalizer.convert(entry);

    expect(component.productCodes).toBe('1934793');
  });
});
