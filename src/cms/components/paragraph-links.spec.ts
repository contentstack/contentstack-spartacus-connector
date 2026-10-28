import { classifyParagraphHref, headingAnchorIds, slugifyHeading } from './paragraph-links';

describe('classifyParagraphHref', () => {
  it('routes root-relative links in-app', () => {
    expect(classifyParagraphHref('/cart')).toEqual({ kind: 'internal', url: '/cart' });
    expect(classifyParagraphHref(' /c/brands?x=1#top ')).toEqual({
      kind: 'internal',
      url: '/c/brands?x=1#top',
    });
  });

  it('treats #fragment links as same-page hash anchors', () => {
    expect(classifyParagraphHref('#details')).toEqual({ kind: 'hash', id: 'details' });
    expect(classifyParagraphHref('#caf%C3%A9')).toEqual({ kind: 'hash', id: 'café' });
  });

  it('leaves everything else to the browser', () => {
    for (const href of [
      'https://example.com/x',
      '//example.com/x',
      'mailto:a@b.c',
      'tel:123',
      'unsafe:javascript:alert(1)',
      'relative/path',
      '#',
      '',
      '   ',
      null,
      undefined,
    ]) {
      expect(classifyParagraphHref(href)).toBeNull();
    }
  });
});

describe('slugifyHeading', () => {
  it('lower-cases, strips accents and hyphenates', () => {
    expect(slugifyHeading('Our Details!')).toBe('our-details');
    expect(slugifyHeading('  Café  Menü ')).toBe('cafe-menu');
    expect(slugifyHeading('???')).toBe('');
  });
});

describe('headingAnchorIds', () => {
  it('gives each heading a unique id and skips empty slugs', () => {
    expect(headingAnchorIds(['Details', 'Other', 'Details', '!!', 'details'])).toEqual([
      'details',
      'other',
      'details-2',
      null,
      'details-3',
    ]);
  });
});
