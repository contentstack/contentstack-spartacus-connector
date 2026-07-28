import { tagEntryTree } from './tag-entry-tree';

/**
 * Verifies Live Preview tagging is actually applied into the fetched data —
 * the gap this closes: previously `addEditableTags` was never called on the
 * data path, so `entry.$` was never populated and component-to-entry
 * navigation / per-field `csEditable` binding could not work.
 *
 * Uses the real `@contentstack/utils` `addEditableTags` (installed), so this
 * asserts genuine tag output, not a mock.
 */
describe('tagEntryTree (live preview)', () => {
  function makePage(): Record<string, unknown> {
    return {
      uid: 'blt_home',
      _content_type_uid: 'cms_page',
      locale: 'en-us',
      title: 'Home',
      section1: [
        {
          uid: 'blt_banner',
          _content_type_uid: 'simple_responsive_banner_component',
          locale: 'en-us',
          headline: 'Hi',
        },
      ],
    };
  }

  it('tags the page entry with its own content type', () => {
    const page = makePage();
    tagEntryTree(page, 'cms_page', 'en-us');

    const tags = page['$'] as Record<string, { 'data-cslp'?: string }> | undefined;
    expect(tags).toBeDefined();
    // some field tag should reference the page content type + uid
    const anyTag = Object.values(tags ?? {}).find((t) => typeof t?.['data-cslp'] === 'string')?.[
      'data-cslp'
    ];
    expect(anyTag).toContain('cms_page');
    expect(anyTag).toContain('blt_home');
  });

  it('re-tags nested component entries with THEIR OWN content type (not the page’s)', () => {
    const page = makePage();
    tagEntryTree(page, 'cms_page', 'en-us');

    const banner = (page['section1'] as Record<string, unknown>[])[0];
    const bannerTags = banner['$'] as Record<string, { 'data-cslp'?: string }> | undefined;
    expect(bannerTags).toBeDefined();
    const bannerTag = Object.values(bannerTags ?? {}).find(
      (t) => typeof t?.['data-cslp'] === 'string',
    )?.['data-cslp'];
    // the component's tags must be rooted at the component's content type + uid,
    // so a click in Visual Builder navigates to the component entry
    expect(bannerTag).toContain('simple_responsive_banner_component');
    expect(bannerTag).toContain('blt_banner');
    expect(bannerTag).not.toContain('cms_page');
  });
});
