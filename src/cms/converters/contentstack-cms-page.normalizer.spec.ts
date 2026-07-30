import { PageRobotsMeta, PageType } from '@spartacus/core';
import { ContentstackConfig } from '../../config/contentstack-config';
import { ContentstackCmsPageNormalizer } from './contentstack-cms-page.normalizer';
import { ContentstackCmsComponentNormalizer } from './contentstack-cms-component.normalizer';
import { ContentstackCmsBannerComponentNormalizer } from './components/contentstack-cms-banner-component.normalizer';
import { ContentstackCmsNavigationComponentNormalizer } from './components/contentstack-cms-navigation-component.normalizer';
import { ContentstackCmsProductCarouselComponentNormalizer } from './components/contentstack-cms-product-carousel-component.normalizer';
import { ContentstackFieldMapper } from './contentstack-field-mapper';
import { ContentstackRestrictionsService } from '../access/contentstack-restrictions.service';
import { cmsPageEntryFixture } from './__fixtures__/cms-page.fixture';

/**
 * Unit test for the page normalizer — the core correctness gate for the
 * Contentstack → Spartacus transform against the starter-pack named-slot-reference
 * schema. Pure input/output; no TestBed needed.
 */
describe('ContentstackCmsPageNormalizer', () => {
  const config: ContentstackConfig = {
    contentstack: {
      delivery: { apiKey: 'k', deliveryToken: 't', environment: 'production' },
      cmsPageContentType: 'cms_page',
    },
  };
  const componentNormalizer = new ContentstackCmsComponentNormalizer(
    new ContentstackCmsBannerComponentNormalizer(),
    new ContentstackCmsNavigationComponentNormalizer(),
    new ContentstackCmsProductCarouselComponentNormalizer(),
    new ContentstackFieldMapper(),
  );
  const normalizer = new ContentstackCmsPageNormalizer(
    config,
    componentNormalizer,
    new ContentstackRestrictionsService(config),
  );

  it('maps entry identity to the Page', () => {
    const result = normalizer.convert(cmsPageEntryFixture);
    expect(result.page?.pageId).toBe('blt_home_page');
    expect(result.page?.title).toBe('Home');
    expect(result.page?.template).toBe('LandingPage2Template');
    // `type` field value maps 1:1 to the Spartacus PageType enum
    expect(result.page?.type).toBe(PageType.CONTENT_PAGE);
  });

  it('buckets referenced components into SAP-named slots', () => {
    const result = normalizer.convert(cmsPageEntryFixture);
    const slots = result.page?.slots ?? {};
    // field uids (section1, body_content) → SAP slot names (Section1, BodyContent)
    expect(Object.keys(slots).sort()).toEqual(['BodyContent', 'Section1']);
    expect(slots['Section1'].components?.[0].uid).toBe('blt_hero_1');
    expect(slots['BodyContent'].components?.[0].uid).toBe('blt_paragraph_1');
  });

  it('maps each component content-type uid to its SAP typecode', () => {
    const result = normalizer.convert(cmsPageEntryFixture);
    const slots = result.page?.slots ?? {};
    expect(slots['Section1'].components?.[0].typeCode).toBe('SimpleResponsiveBannerComponent');
    expect(slots['BodyContent'].components?.[0].typeCode).toBe('CMSParagraphComponent');
  });

  it('flattens referenced entries into components carrying their content fields', () => {
    const result = normalizer.convert(cmsPageEntryFixture);
    expect(result.components?.length).toBe(2);

    const hero = result.components?.find((c) => c.uid === 'blt_hero_1');
    expect(hero?.typeCode).toBe('SimpleResponsiveBannerComponent');
    // Fields are mapped to the stock component's camelCase names: the banner's
    // `url_link` becomes `urlLink` (and author-only fields like `headline` are
    // dropped — stock banners render media + link, not a headline field).
    expect((hero as Record<string, unknown>)['urlLink']).toBe('/c/power-tools');
    // Internal/system keys are stripped from the component payload.
    expect((hero as Record<string, unknown>)['_content_type_uid']).toBeUndefined();
    expect((hero as Record<string, unknown>)['created_at']).toBeUndefined();
  });

  it('sets the slot flexType to the real subtype for CMSFlexComponent', () => {
    // Reference-field model: `summary` field references a cms_flex_component
    // entry (whose `flex_type` is the real render subtype) and a plain
    // add-to-cart component entry.
    const result = normalizer.convert({
      uid: 'p_pdp',
      _content_type_uid: 'cms_page',
      type: 'ProductPage',
      template: 'ProductDetailsPageTemplate',
      summary: [
        {
          uid: 'blt_flex_1',
          _content_type_uid: 'cms_flex_component',
          flex_type: 'ProductIntroComponent',
        },
        {
          uid: 'blt_atc_1',
          _content_type_uid: 'product_add_to_cart_component',
        },
      ],
    });
    expect(result.page?.type).toBe(PageType.PRODUCT_PAGE);
    const summary = result.page?.slots?.['Summary']?.components ?? [];
    // The flex component renders as its subtype; the plain component as its typeCode.
    expect(summary.find((c) => c.typeCode === 'CMSFlexComponent')?.flexType).toBe(
      'ProductIntroComponent',
    );
    expect(summary.find((c) => c.typeCode === 'ProductAddToCartComponent')?.flexType).toBe(
      'ProductAddToCartComponent',
    );
  });

  it('falls back to the `page_type` field for the page-type discriminator', () => {
    const result = normalizer.convert({
      uid: 'p_plp',
      _content_type_uid: 'cms_page',
      page_type: 'CategoryPage',
      template: 'ProductListPageTemplate',
    });
    expect(result.page?.type).toBe(PageType.CATEGORY_PAGE);
  });

  it('expands a CMSTabParagraphContainer into child components referenced by id', () => {
    const result = normalizer.convert({
      uid: 'p_pdp2',
      _content_type_uid: 'cms_page',
      type: 'ProductPage',
      tabs: [
        {
          uid: 'blt_tabs_1',
          _content_type_uid: 'cms_tab_paragraph_container',
          tab_components: [
            { uid: 'tab_details', type_code: 'ProductDetailsTabComponent' },
            { uid: 'tab_specs', type_code: 'ProductSpecsTabComponent' },
          ],
        },
      ],
    });
    const container = result.components?.find((c) => c.uid === 'blt_tabs_1') as any;
    expect(container.typeCode).toBe('CMSTabParagraphContainer');
    // container references its children by space-separated uids
    expect(container.components).toBe('tab_details tab_specs');
    // children are emitted into the flat component list
    expect(result.components?.find((c) => c.uid === 'tab_details')?.typeCode).toBe(
      'ProductDetailsTabComponent',
    );
  });

  it('returns an empty structure body when there are no slots', () => {
    const result = normalizer.convert({
      uid: 'blt_empty',
      _content_type_uid: 'cms_page',
      title: 'Empty',
    });
    expect(result.page?.pageId).toBe('blt_empty');
    expect(result.page?.slots).toEqual({});
    expect(result.components).toEqual([]);
  });

  it('ignores scalar/metadata fields and unresolved-but-uidless values', () => {
    const result = normalizer.convert({
      uid: 'blt_scalars',
      _content_type_uid: 'cms_page',
      title: 'Scalars',
      url: '/scalars',
      template: 'ContentPage1Template',
      robots: 'index, follow',
    });
    expect(result.page?.slots).toEqual({});
    expect(result.components).toEqual([]);
  });

  it('ignores reference fields that are not mapped to a SAP slot (allowlist)', () => {
    // A fully-resolved entry sitting on a field NOT in SLOT_FIELD_TO_SAP_NAME
    // must be dropped, not misclassified as a slot — the allowlist fails safe.
    const result = normalizer.convert({
      uid: 'blt_allowlist',
      _content_type_uid: 'cms_page',
      section1: [
        {
          uid: 'blt_known',
          _content_type_uid: 'cms_paragraph_component',
          created_at: '2026-01-01T00:00:00.000Z',
          content: '<p>mapped</p>',
        },
      ],
      // `related_articles` is a resolved-entry reference field, but it is not a
      // known slot field, so it is ignored entirely.
      related_articles: [
        {
          uid: 'blt_unknown',
          _content_type_uid: 'cms_paragraph_component',
          created_at: '2026-01-01T00:00:00.000Z',
          content: '<p>unmapped</p>',
        },
      ],
    });
    expect(Object.keys(result.page?.slots ?? {})).toEqual(['Section1']);
    expect(result.components?.map((c) => c.uid)).toEqual(['blt_known']);
  });

  it('sets page.label from the slug field, preserving the homepage root', () => {
    // Homepage fixture has url '/', so the label stays '/'.
    expect(normalizer.convert(cmsPageEntryFixture).page?.label).toBe('/');

    // A non-root slug is normalized to a leading slash.
    const about = normalizer.convert({
      uid: 'blt_about',
      _content_type_uid: 'cms_page',
      url: 'about',
    });
    expect(about.page?.label).toBe('/about');
  });

  it('maps the robots string to PageRobotsMeta and sets page.description', () => {
    const result = normalizer.convert({
      uid: 'blt_seo',
      _content_type_uid: 'cms_page',
      url: '/seo',
      description: 'A page with SEO metadata.',
      robots: 'noindex, nofollow',
    });
    expect(result.page?.description).toBe('A page with SEO metadata.');
    expect(result.page?.robots).toEqual([PageRobotsMeta.NOINDEX, PageRobotsMeta.NOFOLLOW]);
  });

  it('omits robots when the field is absent or unrecognized', () => {
    const result = normalizer.convert({
      uid: 'blt_norobots',
      _content_type_uid: 'cms_page',
      url: '/x',
      robots: 'something-else',
    });
    expect(result.page?.robots).toBeUndefined();
  });

  it('treats a custom field as a slot when additionalSlotFields is configured', () => {
    const customConfig: ContentstackConfig = {
      contentstack: {
        ...config.contentstack!,
        additionalSlotFields: { my_promo_strip: 'MyPromoStrip' },
      },
    };
    const customNormalizer = new ContentstackCmsPageNormalizer(
      customConfig,
      componentNormalizer,
      new ContentstackRestrictionsService(customConfig),
    );
    const result = customNormalizer.convert({
      uid: 'blt_custom',
      _content_type_uid: 'cms_page',
      my_promo_strip: [
        {
          uid: 'blt_strip',
          _content_type_uid: 'cms_paragraph_component',
          created_at: '2026-01-01T00:00:00.000Z',
          content: 'promo',
        },
      ],
    });
    // Custom field uid → configured SAP slot position.
    expect(result.page?.slots?.['MyPromoStrip']?.components?.[0].uid).toBe('blt_strip');
  });

  describe('access-control filtering (buildStructure permissions)', () => {
    const gatingConfig: ContentstackConfig = {
      contentstack: {
        ...config.contentstack!,
        accessControl: { enabled: true, accessField: 'access_tags', rolePrefix: '_require-' },
      },
    };
    const gatingNormalizer = new ContentstackCmsPageNormalizer(
      gatingConfig,
      componentNormalizer,
      new ContentstackRestrictionsService(gatingConfig),
    );
    const pageWithGatedComponent = {
      uid: 'blt_p',
      _content_type_uid: 'cms_page',
      section1: [
        {
          uid: 'blt_public',
          _content_type_uid: 'cms_paragraph_component',
          created_at: '2026-01-01T00:00:00.000Z',
          content: 'public',
        },
        {
          uid: 'blt_admin_only',
          _content_type_uid: 'cms_paragraph_component',
          created_at: '2026-01-01T00:00:00.000Z',
          content: 'admins only',
          access_tags: ['_require-b2badmingroup'],
        },
      ],
    };

    it('drops a restricted component from both the slot and the flat components list', () => {
      const result = gatingNormalizer.convert(
        pageWithGatedComponent,
        {},
        new Set(['_require-login']),
      );
      const slotUids = result.page?.slots?.['Section1']?.components?.map((c) => c.uid);
      expect(slotUids).toEqual(['blt_public']);
      expect(result.components?.map((c) => c.uid)).toEqual(['blt_public']);
    });

    it('keeps the restricted component for a user who holds the token', () => {
      const result = gatingNormalizer.convert(
        pageWithGatedComponent,
        {},
        new Set(['_require-login', '_require-b2badmingroup']),
      );
      const slotUids = result.page?.slots?.['Section1']?.components?.map((c) => c.uid);
      expect(slotUids).toEqual(['blt_public', 'blt_admin_only']);
    });

    it('filters nothing when permissions is undefined (feature off / shell path)', () => {
      const result = gatingNormalizer.convert(pageWithGatedComponent, {}, undefined);
      expect(result.page?.slots?.['Section1']?.components?.length).toBe(2);
    });
  });
});
