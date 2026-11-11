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

  it('leaves productCodes undefined when products is not an array', () => {
    const component = normalizer.convert({
      uid: 'blt_carousel_4',
      _content_type_uid: 'product_carousel_component',
      created_at: '2026-01-01T00:00:00.000Z',
      products: 'not-an-array',
    });
    expect(component.productCodes).toBeUndefined();
  });

  it('drops URLs that yield an empty SKU (trailing slash) and keeps the rest', () => {
    const component = normalizer.convert({
      uid: 'blt_carousel_5',
      _content_type_uid: 'product_carousel_component',
      created_at: '2026-01-01T00:00:00.000Z',
      products: [
        'https://api.example.com/occ/v2/electronics/products/',
        'https://api.example.com/occ/v2/electronics/products/1934793',
      ],
    });
    expect(component.productCodes).toBe('1934793');
  });

  it('preserves the authored order of product codes', () => {
    const component = normalizer.convert({
      uid: 'blt_carousel_6',
      _content_type_uid: 'product_carousel_component',
      created_at: '2026-01-01T00:00:00.000Z',
      products: [
        'https://api/occ/v2/electronics/products/300938',
        'https://api/occ/v2/electronics/products/1934793',
        'https://api/occ/v2/electronics/products/29925',
      ],
    });
    expect(component.productCodes).toBe('300938 1934793 29925');
  });

  describe('sap_products (SAP Commerce Cloud app picker)', () => {
    const picked = (...codes: string[]) => ({
      type: 'sapcommercecloud_product',
      data: codes.map((code) => ({
        code,
        name: `Product ${code}`,
        cs_metadata: { multiConfigName: 'hti', isConfigDeleted: false },
      })),
    });

    it('reads codes from the picker field in picked order', () => {
      const component = normalizer.convert({
        uid: 'blt_carousel_7',
        _content_type_uid: 'product_carousel_component',
        created_at: '2026-01-01T00:00:00.000Z',
        sap_products: picked('2278102', '1992693', '1981415'),
      });
      expect(component.productCodes).toBe('2278102 1992693 1981415');
    });

    it('prefers the picker field over the legacy products field', () => {
      const component = normalizer.convert({
        uid: 'blt_carousel_8',
        _content_type_uid: 'product_carousel_component',
        created_at: '2026-01-01T00:00:00.000Z',
        sap_products: picked('300938'),
        products: ['1934793'],
      });
      expect(component.productCodes).toBe('300938');
    });

    it('falls back to products when the picker field is empty or missing', () => {
      for (const sap_products of [undefined, null, { type: 'sapcommercecloud_product', data: [] }]) {
        const component = normalizer.convert({
          uid: 'blt_carousel_9',
          _content_type_uid: 'product_carousel_component',
          created_at: '2026-01-01T00:00:00.000Z',
          sap_products,
          products: ['1934793', '300938'],
        });
        expect(component.productCodes).toBe('1934793 300938');
      }
    });

    it('skips picker items without a string code', () => {
      const component = normalizer.convert({
        uid: 'blt_carousel_10',
        _content_type_uid: 'product_carousel_component',
        created_at: '2026-01-01T00:00:00.000Z',
        sap_products: { data: [{ code: '300938' }, { name: 'no code' }, null, { code: 42 }, { code: '' }] },
      });
      expect(component.productCodes).toBe('300938');
    });
  });
});
