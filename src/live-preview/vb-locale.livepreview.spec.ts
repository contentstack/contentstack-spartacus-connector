import { toSiteLanguage, vbLocaleFromMessage, vbLocaleFromUrl } from './vb-locale';

const mapping = { en: 'en-us', de: 'de-de', ja: 'ja-jp', zh: 'zh-cn' };

describe('toSiteLanguage', () => {
  it('maps a Contentstack locale back through localeMapping', () => {
    expect(toSiteLanguage('de-de', mapping, Object.keys(mapping))).toBe('de');
    expect(toSiteLanguage('ZH-CN', mapping, Object.keys(mapping))).toBe('zh');
  });

  it('falls back to the language part when it is a known language', () => {
    expect(toSiteLanguage('ja-jp', {}, ['ja'])).toBe('ja');
  });

  it('returns undefined for a locale the site has no language for', () => {
    expect(toSiteLanguage('fr-fr', mapping, Object.keys(mapping))).toBeUndefined();
    expect(toSiteLanguage('', mapping)).toBeUndefined();
  });
});

describe('vbLocaleFromMessage', () => {
  const envelope = (over: Record<string, unknown> = {}) => ({
    eventManager: 'contentstack-adv-post-message',
    channel: 'visual-builder',
    type: 'get-locale',
    payload: { locale: 'de-de' },
    metadata: { nature: 'REQUEST' },
    ...over,
  });

  it('reads the locale from a Visual Builder get-locale message', () => {
    expect(vbLocaleFromMessage(envelope())).toBe('de-de');
  });

  it('ignores other messages', () => {
    expect(vbLocaleFromMessage(envelope({ type: 'get-variant-id' }))).toBeUndefined();
    expect(vbLocaleFromMessage(envelope({ channel: 'live-preview' }))).toBeUndefined();
    expect(
      vbLocaleFromMessage({ type: 'get-locale', payload: { locale: 'de-de' } }),
    ).toBeUndefined();
    expect(vbLocaleFromMessage(null)).toBeUndefined();
    expect(vbLocaleFromMessage('webpack-hmr')).toBeUndefined();
  });
});

describe('vbLocaleFromUrl', () => {
  it('reads the locale param Visual Builder loads the storefront with', () => {
    expect(vbLocaleFromUrl('?live_preview=x&locale=ja-jp')).toBe('ja-jp');
    expect(vbLocaleFromUrl('?live_preview=x')).toBeUndefined();
  });
});
