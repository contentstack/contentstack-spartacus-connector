import { ContentstackCmsBannerComponentNormalizer } from './contentstack-cms-banner-component.normalizer';
import { ContentstackEntry } from '../../model/contentstack.model';

describe('ContentstackCmsBannerComponentNormalizer', () => {
  const normalizer = new ContentstackCmsBannerComponentNormalizer();

  it('resolves media from a media_container reference across all breakpoints', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_hero_1',
      _content_type_uid: 'simple_responsive_banner_component',
      created_at: '2026-01-01T00:00:00.000Z',
      headline: 'Power through any job',
      media_container: {
        uid: 'blt_media_1',
        _content_type_uid: 'media_container',
        created_at: '2026-01-01T00:00:00.000Z',
        desktop: { url: 'https://images.cs/desktop.jpg', filename: 'desktop.jpg', content_type: 'image/jpeg' },
        mobile: { url: 'https://images.cs/mobile.jpg', filename: 'mobile.jpg', content_type: 'image/jpeg' },
      },
    };

    const component = normalizer.convert(entry);

    expect(component.media?.desktop).toEqual({
      url: 'https://images.cs/desktop.jpg',
      code: 'desktop.jpg',
      mime: 'image/jpeg',
      altText: undefined,
    });
    expect(component.media?.mobile?.url).toBe('https://images.cs/mobile.jpg');
    expect(component.media?.tablet).toBeUndefined();
  });

  it('resolves media when media_container is a single-element array (multi-reference field)', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_hero_arr',
      _content_type_uid: 'simple_responsive_banner_component',
      created_at: '2026-01-01T00:00:00.000Z',
      // Full-parity pack models media_container as a multi-reference field, so
      // the resolved value is an ARRAY of one media_container entry.
      media_container: [
        {
          uid: 'blt_media_arr',
          _content_type_uid: 'media_container',
          created_at: '2026-01-01T00:00:00.000Z',
          desktop: { url: 'https://images.cs/arr-desktop.jpg', filename: 'arr-desktop.jpg', content_type: 'image/jpeg' },
        },
      ],
    } as unknown as ContentstackEntry;

    const component = normalizer.convert(entry);

    expect(component.media?.desktop?.url).toBe('https://images.cs/arr-desktop.jpg');
  });

  it('resolves media_container breakpoints named media_<breakpoint> (starter-pack convention)', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_hero_mc',
      _content_type_uid: 'simple_responsive_banner_component',
      created_at: '2026-01-01T00:00:00.000Z',
      media_container: {
        uid: 'blt_media_mc',
        _content_type_uid: 'media_container',
        created_at: '2026-01-01T00:00:00.000Z',
        // fields named media_desktop… rather than desktop…
        media_desktop: { url: 'https://images.cs/md.jpg', filename: 'md.jpg', content_type: 'image/jpeg' },
        media_mobile: { url: 'https://images.cs/mm.jpg', filename: 'mm.jpg', content_type: 'image/jpeg' },
      },
    } as unknown as ContentstackEntry;

    const component = normalizer.convert(entry);

    expect(component.media?.desktop?.url).toBe('https://images.cs/md.jpg');
    expect(component.media?.mobile?.url).toBe('https://images.cs/mm.jpg');
    expect(component.media?.tablet).toBeUndefined();
  });

  it('resolves media from direct per-breakpoint file fields, filling gaps from the largest', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_hero_bp',
      _content_type_uid: 'simple_responsive_banner_component',
      created_at: '2026-01-01T00:00:00.000Z',
      media_widescreen: { url: 'https://images.cs/ws.jpg', filename: 'ws.jpg', content_type: 'image/jpeg' },
      media_mobile: { url: 'https://images.cs/mob.jpg', filename: 'mob.jpg', content_type: 'image/jpeg' },
    };

    const component = normalizer.convert(entry);

    expect(component.media?.widescreen?.url).toBe('https://images.cs/ws.jpg');
    expect(component.media?.mobile?.url).toBe('https://images.cs/mob.jpg');
    // missing desktop/tablet fall back to the largest available (widescreen)
    expect(component.media?.desktop?.url).toBe('https://images.cs/ws.jpg');
    expect(component.media?.tablet?.url).toBe('https://images.cs/ws.jpg');
  });

  it('falls back to the direct media file field applied to every breakpoint', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_hero_2',
      _content_type_uid: 'simple_responsive_banner_component',
      created_at: '2026-01-01T00:00:00.000Z',
      media: { url: 'https://images.cs/single.jpg', filename: 'single.jpg', content_type: 'image/jpeg', title: 'Single' },
    };

    const component = normalizer.convert(entry);

    expect(component.media?.desktop?.url).toBe('https://images.cs/single.jpg');
    expect(component.media?.mobile?.url).toBe('https://images.cs/single.jpg');
    expect(component.media?.tablet?.altText).toBe('Single');
    expect(component.media?.widescreen?.code).toBe('single.jpg');
  });

  it('leaves media undefined when neither a media_container nor a direct media file is present', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_hero_3',
      _content_type_uid: 'simple_responsive_banner_component',
      created_at: '2026-01-01T00:00:00.000Z',
      headline: 'No media',
    };

    const component = normalizer.convert(entry);

    expect(component.media).toBeUndefined();
  });
});
