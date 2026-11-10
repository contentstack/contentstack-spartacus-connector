import { ContentstackConfig } from '../../config/contentstack-config';
import { ContentstackCmsPageNormalizer } from './contentstack-cms-page.normalizer';
import { ContentstackCmsComponentNormalizer } from './contentstack-cms-component.normalizer';
import { ContentstackCmsBannerComponentNormalizer } from './components/contentstack-cms-banner-component.normalizer';
import { ContentstackCmsNavigationComponentNormalizer } from './components/contentstack-cms-navigation-component.normalizer';
import { ContentstackCmsProductCarouselComponentNormalizer } from './components/contentstack-cms-product-carousel-component.normalizer';
import { ContentstackFieldMapper } from './contentstack-field-mapper';
import { ContentstackRestrictionsService } from '../access/contentstack-restrictions.service';
import { ContentstackComponentTypeRegistry } from '../model/contentstack-component-type.registry';
import { tagEntryTree } from '../../live-preview/tag-entry-tree';
import { mergeStructures } from '../model/merge-structures';

/**
 * Visual Builder slot editing (DX-27689): with Live Preview tags on the page
 * entry, every slot carries its reference-field tag and every component its
 * `field.N` position tag, with N the index in the authored field.
 */
describe('ContentstackCmsPageNormalizer (Live Preview slot tags)', () => {
  const config: ContentstackConfig = {
    contentstack: {
      delivery: { apiKey: 'k', deliveryToken: 't', environment: 'development' },
      cmsPageContentType: 'landing_page',
      accessControl: { enabled: true },
    },
  } as ContentstackConfig;
  const componentNormalizer = new ContentstackCmsComponentNormalizer(
    new ContentstackCmsBannerComponentNormalizer(),
    new ContentstackCmsNavigationComponentNormalizer(),
    new ContentstackCmsProductCarouselComponentNormalizer(),
    new ContentstackFieldMapper(),
    { contentstack: { delivery: { livePreview: true } } } as typeof config,
  );
  const normalizer = new ContentstackCmsPageNormalizer(
    config,
    componentNormalizer,
    new ContentstackRestrictionsService(config),
    new ContentstackComponentTypeRegistry(),
  );

  const paragraph = (uid: string, extra: Record<string, unknown> = {}) => ({
    uid,
    _content_type_uid: 'cms_paragraph_component',
    title: uid,
    content: `<p>${uid}</p>`,
    ...extra,
  });

  const page = (fields: Record<string, unknown>) => {
    const entry = {
      uid: 'home',
      _content_type_uid: 'landing_page',
      title: 'Home',
      url: '/',
      locale: 'en-us',
      ...fields,
    };
    tagEntryTree(entry, 'landing_page', 'en-us');
    return entry;
  };

  it('tags the slot with its field and each component with its field position', () => {
    const result = normalizer.convert(page({ section1: [paragraph('a'), paragraph('b')] }));
    const slot = result.page?.slots?.['Section1'];
    expect(slot?.properties?.cslp).toBe('landing_page.home.en-us.section1');
    expect(slot?.components?.map((c) => c.properties?.cslp)).toEqual([
      'landing_page.home.en-us.section1.0',
      'landing_page.home.en-us.section1.1',
    ]);
    // The raw tagged entry still rides along for the editable renderers.
    expect((slot?.components?.[0].properties?.data as { uid: string }).uid).toBe('a');
  });

  it('keeps the original index when an unresolved reference is skipped', () => {
    const result = normalizer.convert(
      page({
        section1: [{ uid: 'unresolved' }, paragraph('b')].map((x, i) => (i === 0 ? null : x)),
      }),
    );
    expect(result.page?.slots?.['Section1'].components?.[0].properties?.cslp).toBe(
      'landing_page.home.en-us.section1.1',
    );
  });

  it('keeps the original index when a restricted component is filtered out', () => {
    const result = normalizer.convert(
      page({
        section1: [paragraph('gated', { access_tags: ['_require-b2b'] }), paragraph('open')],
      }),
      {},
      new Set<string>(),
    );
    const comps = result.page?.slots?.['Section1'].components ?? [];
    expect(comps.map((c) => c.uid)).toEqual(['open']);
    expect(comps[0].properties?.cslp).toBe('landing_page.home.en-us.section1.1');
  });

  it('emits an authored-but-empty slot in preview so Visual Builder can add to it', () => {
    const result = normalizer.convert(page({ section1: [] }));
    expect(result.page?.slots?.['Section1']).toEqual({
      components: [],
      properties: { cslp: 'landing_page.home.en-us.section1', csEmpty: true },
    });
  });

  it('adds nothing when the entry carries no Live Preview tags (delivery build)', () => {
    const entry = {
      uid: 'home',
      _content_type_uid: 'landing_page',
      url: '/',
      section1: [paragraph('a')],
      section2: [],
    };
    const result = normalizer.convert(entry);
    expect(result.page?.slots?.['Section1'].properties).toBeUndefined();
    expect(result.page?.slots?.['Section1'].components?.[0].properties).toBeUndefined();
    expect(result.page?.slots?.['Section2']).toBeUndefined();
  });

  it('an empty authored slot never blanks or tags the OCC slot it overlays', () => {
    const cs = normalizer.convert(page({ section1: [] }));
    const occSlot = { components: [{ uid: 'occBanner', typeCode: 'SimpleBannerComponent' }] };
    const merged = mergeStructures(
      { page: { slots: { Section1: occSlot } }, components: [{ uid: 'occBanner' }] },
      cs,
    );
    expect(merged.page?.slots?.['Section1']).toEqual(occSlot);
  });

  it('keeps the empty authored slot (and its add placeholder) where OCC has nothing', () => {
    const cs = normalizer.convert(page({ section1: [] }));
    const merged = mergeStructures({ page: { slots: {} }, components: [] }, cs);
    expect(merged.page?.slots?.['Section1'].properties?.csEmpty).toBe(true);
  });
});
