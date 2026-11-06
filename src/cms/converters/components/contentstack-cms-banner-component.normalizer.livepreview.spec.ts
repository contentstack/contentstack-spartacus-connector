import { ContentstackCmsBannerComponentNormalizer } from './contentstack-cms-banner-component.normalizer';
import { tagEntryTree } from '../../../live-preview/tag-entry-tree';

/** DX-27705: the banner image is tagged with the field it is resolved from. */
describe('ContentstackCmsBannerComponentNormalizer (Live Preview image tag)', () => {
  const normalizer = new ContentstackCmsBannerComponentNormalizer();
  const file = (name: string) => ({
    uid: `f_${name}`,
    url: `https://images/${name}.jpg`,
    filename: `${name}.jpg`,
    content_type: 'image/jpeg',
  });
  const banner = (fields: Record<string, unknown>) => {
    const entry = { uid: 'b1', _content_type_uid: 'simple_responsive_banner_component', ...fields };
    tagEntryTree(entry, 'simple_responsive_banner_component', 'en-us');
    return entry;
  };
  // The component normalizer only passes `$` on in preview builds.
  const preview = (entry: { $?: unknown }) => ({ $: entry.$ });
  const mediaCslp = (c: unknown) => (c as { mediaCslp?: string }).mediaCslp;

  it('tags the single media file', () => {
    const entry = banner({ media: file('hero') });
    expect(mediaCslp(normalizer.convert(entry, preview(entry)))).toBe(
      'simple_responsive_banner_component.b1.en-us.media',
    );
  });

  it('tags the per-breakpoint file used, preferring desktop', () => {
    const entry = banner({ media_mobile: file('m'), media_desktop: file('d') });
    expect(mediaCslp(normalizer.convert(entry, preview(entry)))).toBe(
      'simple_responsive_banner_component.b1.en-us.media_desktop',
    );
  });

  it('tags the media_container entry file when the banner uses a container', () => {
    const entry = banner({
      media_container: [
        {
          uid: 'mc1',
          _content_type_uid: 'media_container',
          created_at: '2026-11-06T00:00:00Z',
          desktop: file('c'),
        },
      ],
      media: file('ignored'),
    });
    expect(mediaCslp(normalizer.convert(entry, preview(entry)))).toBe(
      'media_container.mc1.en-us.desktop',
    );
  });

  it('adds no tag outside a preview build', () => {
    const entry = banner({ media: file('hero') });
    expect(mediaCslp(normalizer.convert(entry, {}))).toBeUndefined();
  });
});
