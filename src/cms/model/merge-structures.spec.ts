import { CmsStructureModel } from '@spartacus/core';
import { mergeStructures } from './merge-structures';

/**
 * Unit test for the hybrid layered merge — the correctness gate for
 * "OCC base < global shell < Contentstack page" slot resolution. Pure
 * input/output; no TestBed.
 */
describe('mergeStructures', () => {
  const occBase: CmsStructureModel = {
    page: {
      pageId: 'occ-home',
      template: 'LandingPage2Template',
      type: 'ContentPage',
      title: 'OCC Home',
      slots: {
        Section1: { components: [{ uid: 'occ-hero', typeCode: 'BannerComponent' }] },
        Section2: { components: [{ uid: 'occ-promo', typeCode: 'BannerComponent' }] },
        Footer: { components: [{ uid: 'occ-footer', typeCode: 'FooterNavigationComponent' }] },
      },
    },
    components: [
      { uid: 'occ-hero', typeCode: 'BannerComponent' },
      { uid: 'occ-promo', typeCode: 'BannerComponent' },
      { uid: 'occ-footer', typeCode: 'FooterNavigationComponent' },
    ],
  };

  it('returns {} when no layer has content', () => {
    expect(mergeStructures(undefined, undefined, undefined)).toEqual({});
  });

  it('returns the OCC base unchanged when there are no overrides', () => {
    const result = mergeStructures(occBase);
    expect(Object.keys(result.page?.slots ?? {}).sort()).toEqual([
      'Footer',
      'Section1',
      'Section2',
    ]);
    expect(result.page?.template).toBe('LandingPage2Template');
  });

  it('overrides only the authored slot, leaving the rest from OCC', () => {
    const csPage: CmsStructureModel = {
      page: {
        pageId: 'cs-home',
        title: 'CS Home',
        slots: {
          Section1: { components: [{ uid: 'cs-hero', typeCode: 'SimpleBannerComponent' }] },
        },
      },
      components: [{ uid: 'cs-hero', typeCode: 'SimpleBannerComponent' }],
    };

    const result = mergeStructures(occBase, undefined, csPage);
    // Section1 replaced by Contentstack; Section2 + Footer stay from OCC.
    expect(result.page?.slots?.['Section1'].components?.[0].uid).toBe('cs-hero');
    expect(result.page?.slots?.['Section2'].components?.[0].uid).toBe('occ-promo');
    expect(result.page?.slots?.['Footer'].components?.[0].uid).toBe('occ-footer');
    // Base pins the structural fields; editorial fields come from the override.
    expect(result.page?.template).toBe('LandingPage2Template');
    expect(result.page?.pageId).toBe('occ-home');
    expect(result.page?.title).toBe('CS Home');
    // Components are the union of both layers.
    expect(result.components?.map((c) => c.uid).sort()).toEqual([
      'cs-hero',
      'occ-footer',
      'occ-hero',
      'occ-promo',
    ]);
  });

  it('layers global shell between OCC and the page (page wins over global wins over OCC)', () => {
    const globalShell: CmsStructureModel = {
      page: {
        slots: {
          Footer: { components: [{ uid: 'cs-footer', typeCode: 'FooterNavigationComponent' }] },
          Section2: { components: [{ uid: 'global-promo', typeCode: 'BannerComponent' }] },
        },
      },
      components: [
        { uid: 'cs-footer', typeCode: 'FooterNavigationComponent' },
        { uid: 'global-promo', typeCode: 'BannerComponent' },
      ],
    };
    const csPage: CmsStructureModel = {
      page: { slots: { Section2: { components: [{ uid: 'cs-promo', typeCode: 'SimpleBannerComponent' }] } } },
      components: [{ uid: 'cs-promo', typeCode: 'SimpleBannerComponent' }],
    };

    const result = mergeStructures(occBase, globalShell, csPage);
    // Footer: global overrides OCC (page doesn't touch it).
    expect(result.page?.slots?.['Footer'].components?.[0].uid).toBe('cs-footer');
    // Section2: page wins over global wins over OCC.
    expect(result.page?.slots?.['Section2'].components?.[0].uid).toBe('cs-promo');
    // Section1: untouched → OCC.
    expect(result.page?.slots?.['Section1'].components?.[0].uid).toBe('occ-hero');
  });

  it('uses the override as the full page when there is no OCC base (CS-only route)', () => {
    const csPage: CmsStructureModel = {
      page: {
        pageId: 'cs-landing',
        template: 'ContentPage1Template',
        type: 'ContentPage',
        slots: { Section1: { components: [{ uid: 'cs-only', typeCode: 'SimpleBannerComponent' }] } },
      },
      components: [{ uid: 'cs-only', typeCode: 'SimpleBannerComponent' }],
    };

    const result = mergeStructures(undefined, undefined, csPage);
    // No base → the Contentstack template/pageId stand.
    expect(result.page?.template).toBe('ContentPage1Template');
    expect(result.page?.pageId).toBe('cs-landing');
    expect(result.page?.slots?.['Section1'].components?.[0].uid).toBe('cs-only');
  });
});
