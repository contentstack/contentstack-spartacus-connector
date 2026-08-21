import { retargetTagLocale } from './tag-entry-tree';

/**
 * Pure-logic spec for the CSLP tag locale-swap used by the language-switch
 * retag in `ContentstackLivePreviewService`. Framework-free (no DOM).
 */
describe('retargetTagLocale', () => {
  it('swaps the locale segment of a wrapper tag (contentType.uid.locale)', () => {
    expect(
      retargetTagLocale('simple_responsive_banner_component.blt123.en-us', 'de-de'),
    ).toBe('simple_responsive_banner_component.blt123.de-de');
  });

  it('swaps the locale segment of a per-field tag, preserving trailing segments', () => {
    expect(retargetTagLocale('cms_paragraph_component.blt9.en-us.content', 'ja-jp')).toBe(
      'cms_paragraph_component.blt9.ja-jp.content',
    );
  });

  it('preserves nested modular-block field segments after the locale', () => {
    expect(retargetTagLocale('ct.blt1.en-us.blocks.0.title', 'zh-cn')).toBe(
      'ct.blt1.zh-cn.blocks.0.title',
    );
  });

  it('keeps the entry uid (locale-invariant) unchanged', () => {
    const out = retargetTagLocale('ct.blt_same_uid.en-us', 'de-de');
    expect(out.split('.')[1]).toBe('blt_same_uid');
  });

  it('returns the tag unchanged when the locale already matches', () => {
    const tag = 'ct.blt123.de-de';
    expect(retargetTagLocale(tag, 'de-de')).toBe(tag);
  });

  it('returns the tag unchanged when it has fewer than 3 segments', () => {
    expect(retargetTagLocale('ct.blt123', 'de-de')).toBe('ct.blt123');
  });
});
