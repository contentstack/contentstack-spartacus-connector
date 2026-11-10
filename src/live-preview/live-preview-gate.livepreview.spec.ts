import { isInPreviewContext, isLivePreviewActive, regionHost } from './live-preview-gate';

const top = {};
const framed = { self: {}, top, location: { search: '' } };
const direct = (search = '') => {
  const w: { self?: unknown; top?: unknown; location: { search: string } } = {
    location: { search },
  };
  w.self = w;
  w.top = w;
  return w;
};

const delivery = (over: Record<string, unknown> = {}) =>
  ({
    apiKey: 'k',
    deliveryToken: 'd',
    environment: 'development',
    livePreview: true,
    previewToken: 'p',
    ...over,
  }) as never;

describe('isLivePreviewActive', () => {
  it('is off without livePreview or without a preview token', () => {
    expect(isLivePreviewActive(delivery({ livePreview: false }), framed, true)).toBe(false);
    expect(isLivePreviewActive(delivery({ previewToken: '' }), framed, true)).toBe(false);
    expect(isLivePreviewActive(undefined, framed, true)).toBe(false);
  });

  it('is off in a production build unless livePreviewAllowInProduction is set', () => {
    expect(isLivePreviewActive(delivery(), framed, false)).toBe(false);
    expect(
      isLivePreviewActive(delivery({ livePreviewAllowInProduction: true }), framed, false),
    ).toBe(true);
  });

  it('in the browser, requires an iframe or a Live Preview URL param', () => {
    expect(isLivePreviewActive(delivery(), direct(), true)).toBe(false);
    expect(isLivePreviewActive(delivery(), framed, true)).toBe(true);
    expect(isLivePreviewActive(delivery(), direct('?live_preview=abc'), true)).toBe(true);
    expect(isLivePreviewActive(delivery(), direct('?preview_timestamp=2026-11-11'), true)).toBe(
      true,
    );
  });

  it('keeps a preview deployment inert for a visitor who opens the URL directly', () => {
    const preview = delivery({ livePreviewAllowInProduction: true });
    expect(isLivePreviewActive(preview, direct('?utm_source=mail'), false)).toBe(false);
  });

  it('on the server (no window) decides on config and build mode only', () => {
    expect(isLivePreviewActive(delivery(), undefined, true)).toBe(true);
    expect(isLivePreviewActive(delivery(), undefined, false)).toBe(false);
  });
});

describe('isInPreviewContext', () => {
  it('treats a cross-origin top that throws as framed', () => {
    const w = {
      self: {},
      get top(): unknown {
        throw new Error('cross-origin');
      },
      location: { search: '' },
    };
    expect(isInPreviewContext(w)).toBe(true);
  });
});

describe('regionHost', () => {
  it('derives preview and app hosts from the region', () => {
    expect(regionHost('us', 'preview')).toBe('rest-preview.contentstack.com');
    expect(regionHost('eu', 'preview')).toBe('eu-rest-preview.contentstack.com');
    expect(regionHost('azure-na', 'application')).toBe('azure-na-app.contentstack.com');
    expect(regionHost(undefined, 'application')).toBe('app.contentstack.com');
  });

  it('falls back to North America for an unknown region', () => {
    expect(regionHost('bogus', 'preview')).toBe('rest-preview.contentstack.com');
  });
});
