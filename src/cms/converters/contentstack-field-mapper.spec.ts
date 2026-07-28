import { ContentstackFieldMapper } from './contentstack-field-mapper';

/**
 * Exercises every branch of the author-friendly → OOTB field translation, plus
 * the snake_case/camelCase fallbacks and the default values each stock Spartacus
 * component relies on. This is the layer that lets Contentstack authors use clean
 * lowercase field uids instead of mirroring OCC's payload.
 */
describe('ContentstackFieldMapper', () => {
  const mapper = new ContentstackFieldMapper();

  describe('banner components', () => {
    it.each(['SimpleResponsiveBannerComponent', 'SimpleBannerComponent', 'BannerComponent'])(
      'builds a media Image + urlLink for %s',
      (typeCode) => {
        const out = mapper.map(typeCode, {
          image_url: 'https://cdn/x.jpg',
          alt_text: 'Alt',
          url_link: '/deals',
          name: 'Hero',
        });
        expect(out).toEqual({
          urlLink: '/deals',
          name: 'Hero',
          media: { url: 'https://cdn/x.jpg', altText: 'Alt' },
        });
      },
    );

    it('falls back url→image_url and name→alt, and defaults urlLink to empty', () => {
      const out = mapper.map('SimpleBannerComponent', {
        url: 'https://cdn/y.jpg',
        name: 'OnlyName',
      });
      expect(out['media']).toEqual({ url: 'https://cdn/y.jpg', altText: 'OnlyName' });
      expect(out['urlLink']).toBe('');
      expect(out['name']).toBe('OnlyName');
    });

    it('omits media (and name) when no image url is present', () => {
      const out = mapper.map('SimpleBannerComponent', { url_link: '/x' });
      expect(out['media']).toBeUndefined();
      expect('name' in out).toBe(false);
      expect(out['urlLink']).toBe('/x');
    });
  });

  describe('CMSLinkComponent', () => {
    it('maps link_name / url_link / target from authoring fields', () => {
      expect(
        mapper.map('CMSLinkComponent', { link_name: 'Help', url_link: '/help', target: true }),
      ).toEqual({ linkName: 'Help', url: '/help', target: 'true' });
    });

    it('accepts camelCase aliases and defaults target to "false"', () => {
      expect(mapper.map('CMSLinkComponent', { linkName: 'X', url: '/u' })).toEqual({
        linkName: 'X',
        url: '/u',
        target: 'false',
      });
    });

    it('defaults linkName and url to empty strings', () => {
      expect(mapper.map('CMSLinkComponent', {})).toEqual({
        linkName: '',
        url: '',
        target: 'false',
      });
    });
  });

  describe('CMSParagraphComponent', () => {
    it('passes content through, defaulting to an empty string', () => {
      expect(mapper.map('CMSParagraphComponent', { content: '<p>Hi</p>' })).toEqual({
        content: '<p>Hi</p>',
      });
      expect(mapper.map('CMSParagraphComponent', {})).toEqual({ content: '' });
    });
  });

  describe('ProductCarouselComponent', () => {
    it('maps title/productCodes and stringifies popup, defaulting scroll', () => {
      expect(
        mapper.map('ProductCarouselComponent', {
          cms_title: 'Top Sellers',
          product_codes: '1 2 3',
          popup: true,
        }),
      ).toEqual({
        title: 'Top Sellers',
        productCodes: '1 2 3',
        scroll: 'ALLVISIBLE',
        popup: 'true',
      });
    });

    it('applies defaults when fields are absent', () => {
      expect(mapper.map('ProductCarouselComponent', {})).toEqual({
        title: '',
        productCodes: '',
        scroll: 'ALLVISIBLE',
        popup: 'false',
      });
    });
  });

  describe('SearchBoxComponent', () => {
    it('stringifies every field with sensible defaults', () => {
      expect(mapper.map('SearchBoxComponent', {})).toEqual({
        maxProducts: '5',
        maxSuggestions: '5',
        displayProducts: 'true',
        displaySuggestions: 'true',
        displayProductImages: 'true',
        minCharactersBeforeRequest: '3',
        waitTimeBeforeRequest: '500',
      });
    });

    it('stringifies overridden numeric/boolean fields', () => {
      const out = mapper.map('SearchBoxComponent', {
        max_products: 10,
        display_products: false,
      });
      expect(out['maxProducts']).toBe('10');
      expect(out['displayProducts']).toBe('false');
    });
  });

  describe('CMSFlexComponent', () => {
    it('resolves flexType from the authored flex_type', () => {
      expect(mapper.map('CMSFlexComponent', { flex_type: 'ProductIntroComponent' })).toEqual({
        flexType: 'ProductIntroComponent',
      });
    });

    it('defaults flexType to the typeCode when flex_type is missing/blank', () => {
      expect(mapper.map('CMSFlexComponent', {})).toEqual({ flexType: 'CMSFlexComponent' });
      expect(mapper.map('CMSFlexComponent', { flex_type: '' })).toEqual({
        flexType: 'CMSFlexComponent',
      });
    });
  });

  describe('CMSSiteContextComponent', () => {
    it('passes the context field through', () => {
      expect(
        mapper.map('CMSSiteContextComponent', { context: 'LanguageCurrencyComponent' }),
      ).toEqual({ context: 'LanguageCurrencyComponent' });
    });
  });

  describe('ProductReferencesComponent', () => {
    it('maps reference config with defaults', () => {
      expect(mapper.map('ProductReferencesComponent', {})).toEqual({
        title: '',
        productReferenceTypes: 'SIMILAR',
        maximumNumberProducts: '5',
        displayProductTitles: 'true',
        displayProductPrices: 'true',
      });
    });

    it('honours authored reference_types and max_products', () => {
      const out = mapper.map('ProductReferencesComponent', {
        cms_title: 'You may also like',
        reference_types: 'ACCESSORIES',
        max_products: 8,
      });
      expect(out['title']).toBe('You may also like');
      expect(out['productReferenceTypes']).toBe('ACCESSORIES');
      expect(out['maximumNumberProducts']).toBe('8');
    });
  });

  describe('unknown types (passthrough)', () => {
    it('drops authoring-only keys and keeps the rest as-is', () => {
      const out = mapper.map('SomeCustomComponent', {
        type_code: 'x',
        slot: 'Section1',
        tab_components: [],
        headline: 'Keep me',
        count: 3,
      });
      expect(out).toEqual({ headline: 'Keep me', count: 3 });
    });
  });
});
