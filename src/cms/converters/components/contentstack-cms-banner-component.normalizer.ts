import { Injectable } from '@angular/core';
import { CmsBannerComponent, CmsBannerComponentMedia, Converter } from '@spartacus/core';
import {
  ContentstackEntry,
  ContentstackFile,
  ContentstackReference,
} from '../../model/contentstack.model';
import { isContentstackFile, isMediaContainer } from '../../model/type-guards';

const BREAKPOINTS = ['desktop', 'mobile', 'tablet', 'widescreen'] as const;

/**
 * Resolves `simple_responsive_banner_component`'s media into
 * `CmsBannerComponent.media`, in priority order:
 *  1. per-breakpoint `media_container` reference (desktop/mobile/tablet/widescreen
 *     file fields on a referenced media_container entry), else
 *  2. **direct per-breakpoint file fields on the banner** (`media_desktop`,
 *     `media_mobile`, `media_tablet`, `media_widescreen`) — the responsive shape
 *     the starter pack uses: real per-breakpoint images that resolve inline with
 *     the banner (no nested reference / include config), else
 *  3. a single direct `media` file field applied to every breakpoint.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsBannerComponentNormalizer implements Converter<
  ContentstackEntry,
  CmsBannerComponent
> {
  convert(source: ContentstackEntry, target: CmsBannerComponent = {}): CmsBannerComponent {
    const container = source['media_container'] as ContentstackReference | undefined;
    if (isMediaContainer(container)) {
      const media: CmsBannerComponent['media'] = {};
      for (const breakpoint of BREAKPOINTS) {
        const file = container[breakpoint];
        if (isContentstackFile(file)) {
          media[breakpoint] = this.toBannerMedia(file);
        }
      }
      target.media = media;
      return target;
    }

    // Direct per-breakpoint file fields on the banner (`media_<breakpoint>`).
    // Collect into a plain record first so we can pick a fallback without
    // property access on the `CmsBannerComponent['media']` union type.
    const files: Record<string, CmsBannerComponentMedia> = {};
    for (const breakpoint of BREAKPOINTS) {
      const file = source[`media_${breakpoint}`];
      if (isContentstackFile(file)) {
        files[breakpoint] = this.toBannerMedia(file);
      }
    }
    if (Object.keys(files).length) {
      // Fill any missing breakpoint from the largest available so every
      // breakpoint renders something.
      const fallback =
        files['widescreen'] ?? files['desktop'] ?? files['tablet'] ?? files['mobile'];
      const media: CmsBannerComponent['media'] = {};
      for (const breakpoint of BREAKPOINTS) {
        media[breakpoint] = files[breakpoint] ?? fallback;
      }
      target.media = media;
      return target;
    }

    const directMedia = source['media'];
    if (isContentstackFile(directMedia)) {
      const media: CmsBannerComponent['media'] = {};
      for (const breakpoint of BREAKPOINTS) {
        media[breakpoint] = this.toBannerMedia(directMedia);
      }
      target.media = media;
    }

    return target;
  }

  private toBannerMedia(file: ContentstackFile): CmsBannerComponentMedia {
    return {
      url: file.url,
      code: file.filename,
      mime: file.content_type,
      altText: file.title,
    };
  }
}
