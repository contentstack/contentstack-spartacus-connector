import { ContentstackFieldMapper } from './contentstack-field-mapper';

describe('ContentstackFieldMapper', () => {
  const mapper = new ContentstackFieldMapper();

  describe('SimpleResponsiveBannerComponent', () => {
    it('passes headline + content through when present (for custom card renderers)', () => {
      const out = mapper.map('SimpleResponsiveBannerComponent', {
        name: 'Units Home',
        headline: 'Units',
        content: 'Units represent departments, stores, regions…',
        url_link: '/organization/units',
      });

      expect(out['headline']).toBe('Units');
      expect(out['content']).toBe('Units represent departments, stores, regions…');
      expect(out['urlLink']).toBe('/organization/units');
      expect(out['name']).toBe('Units Home');
    });

    it('adds no headline/content keys for an image-only banner (harmless superset)', () => {
      const out = mapper.map('SimpleResponsiveBannerComponent', {
        name: 'Powertools Homepage Splash',
        url_link: '/Open-Catalogue/c/1',
      });

      expect('headline' in out).toBe(false);
      expect('content' in out).toBe(false);
      expect(out['urlLink']).toBe('/Open-Catalogue/c/1');
    });
  });

  it('maps CMSLinkComponent authoring fields to the OOTB shape', () => {
    const out = mapper.map('CMSLinkComponent', {
      link_name: 'View my quotes',
      url_link: '/my-account/quotes',
      target: true,
    });

    expect(out).toEqual({
      linkName: 'View my quotes',
      url: '/my-account/quotes',
      target: 'true',
    });
  });

  it('maps CMSParagraphComponent content', () => {
    expect(mapper.map('CMSParagraphComponent', { content: '<p>Hi</p>' })).toEqual({
      content: '<p>Hi</p>',
    });
  });
});
