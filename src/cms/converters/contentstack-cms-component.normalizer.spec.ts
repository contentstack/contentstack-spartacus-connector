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
    new ContentstackFieldMapper(),
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

  it('resolves the SAP typeCode from the content-type uid (mapped and identity)', () => {
    expect(
      normalizer.convert({ uid: 'a', _content_type_uid: 'simple_banner_component' }).typeCode,
    ).toBe('SimpleBannerComponent');
    // Custom/unmapped content types fall through as identity.
    expect(normalizer.convert({ uid: 'b', _content_type_uid: 'my_custom_widget' }).typeCode).toBe(
      'my_custom_widget',
    );
  });

  it('leaves modifiedTime undefined when the entry has no updated_at', () => {
    const component = normalizer.convert({
      uid: 'a',
      _content_type_uid: 'cms_paragraph_component',
    });
    expect(component.modifiedTime).toBeUndefined();
  });

  it('merges onto a provided target rather than replacing it', () => {
    const target = { container: true } as any;
    const component = normalizer.convert(
      { uid: 'a', _content_type_uid: 'cms_paragraph_component', content: 'Hi' },
      target,
    );
    expect(component.container).toBe(true);
    expect((component as any).content).toBe('Hi');
  });

  it('applies the field mapper for stock components (CMSLinkComponent)', () => {
    const component = normalizer.convert({
      uid: 'blt_link',
      _content_type_uid: 'cms_link_component',
      link_name: 'Contact',
      url_link: '/contact',
    });
    expect(component.typeCode).toBe('CMSLinkComponent');
    expect((component as any).linkName).toBe('Contact');
    expect((component as any).url).toBe('/contact');
    expect((component as any).target).toBe('false');
  });

  it('resolves CMSFlexComponent flexType through the field mapper', () => {
    const component = normalizer.convert({
      uid: 'blt_flex',
      _content_type_uid: 'cms_flex_component',
      flex_type: 'ProductIntroComponent',
    });
    expect(component.typeCode).toBe('CMSFlexComponent');
    expect((component as any).flexType).toBe('ProductIntroComponent');
  });

  it('maps cms_tab_paragraph_component content through the field mapper', () => {
    const component = normalizer.convert({
      uid: 'blt_tab_paragraph',
      _content_type_uid: 'cms_tab_paragraph_component',
      content: '<p>Specs</p>',
    });
    expect(component.typeCode).toBe('CMSTabParagraphComponent');
    expect((component as any).content).toBe('<p>Specs</p>');
  });

  it('routes banner typecodes through the banner normalizer (media resolved)', () => {
    const component = normalizer.convert({
      uid: 'blt_banner',
      _content_type_uid: 'simple_responsive_banner_component',
      media: {
        url: 'https://images.cs/hero.jpg',
        filename: 'hero.jpg',
        content_type: 'image/jpeg',
      },
    });
    expect(component.typeCode).toBe('SimpleResponsiveBannerComponent');
    expect((component as any).media?.desktop?.url).toBe('https://images.cs/hero.jpg');
  });

  it('routes navigation typecodes through the navigation normalizer', () => {
    const component = normalizer.convert({
      uid: 'blt_nav',
      _content_type_uid: 'footer_navigation_component',
      navigation_node: {
        uid: 'blt_node',
        _content_type_uid: 'nav_node',
        created_at: '2026-01-01T00:00:00.000Z',
        uid_val: 'FooterRoot',
        title: 'Footer',
      },
    });
    expect(component.typeCode).toBe('FooterNavigationComponent');
    expect((component as any).navigationNode?.uid).toBe('FooterRoot');
  });

  it('routes product carousel through the carousel normalizer (products → productCodes)', () => {
    const component = normalizer.convert({
      uid: 'blt_carousel',
      _content_type_uid: 'product_carousel_component',
      cms_title: 'Featured',
      products: [
        'https://api/occ/v2/electronics/products/111',
        'https://api/occ/v2/electronics/products/222',
      ],
    });
    expect(component.typeCode).toBe('ProductCarouselComponent');
    expect((component as any).title).toBe('Featured');
    expect((component as any).productCodes).toBe('111 222');
  });
});
