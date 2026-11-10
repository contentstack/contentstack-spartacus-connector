import { Injectable } from '@angular/core';
import { CmsBannerComponent, CmsBannerComponentMedia, Converter } from '@spartacus/core';
import {
  ContentstackEntry,
  ContentstackFile,
  ContentstackReference,
} from '../../model/contentstack.model';
import { isContentstackFile, isMediaContainer } from '../../model/type-guards';

const BREAKPOINTS = ['desktop', 'mobile', 'tablet', 'widescreen'] as const;
/** Order in which a breakpoint image is picked as "the" image to edit inline. */
const EDIT_ORDER = ['desktop', 'widescreen', 'tablet', 'mobile'] as const;

type TagMap = Record<string, { 'data-cslp'?: string } | undefined>;
const tagOf = (entry: unknown, field: string): string | undefined =>
  (entry as { $?: TagMap } | undefined)?.$?.[field]?.['data-cslp'];

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
    const result = this.resolveMedia(source, target);
    // Live Preview: tag the image with the field it actually came from, so
    // clicking it in Visual Builder edits that image (container file, per-
    // breakpoint file or the single `media` file). Only when the component
    // carries Live Preview tags (`$`), which the component normalizer adds in
    // preview builds only.
    if ((target as { $?: unknown }).$) {
      const tag = this.mediaTag(source);
      if (tag) {
        (result as { mediaCslp?: string }).mediaCslp = tag;
      }
    }
    return result;
  }

  /** Edit tag of the field the banner image is resolved from (same priority as {@link resolveMedia}). */
  protected mediaTag(source: ContentstackEntry): string | undefined {
    const rawContainer = source['media_container'];
    const container = (Array.isArray(rawContainer) ? rawContainer[0] : rawContainer) as
      ContentstackReference | undefined;
    if (isMediaContainer(container)) {
      const bp = EDIT_ORDER.find((b) => isContentstackFile(container[b]));
      return bp ? tagOf(container, bp) : undefined;
    }
    const bp = EDIT_ORDER.find((b) => isContentstackFile(source[`media_${b}`]));
    if (bp) {
      return tagOf(source, `media_${bp}`);
    }
    return isContentstackFile(source['media']) ? tagOf(source, 'media') : undefined;
  }

  protected resolveMedia(
    source: ContentstackEntry,
    target: CmsBannerComponent,
  ): CmsBannerComponent {
    // Contentstack delivers reference fields as arrays even for a single
    // reference, so unwrap `[mediaContainer]` before checking its shape --
    // same pattern as ContentstackCmsNavigationComponentNormalizer.
    const rawContainer = source['media_container'];
    const container = (Array.isArray(rawContainer) ? rawContainer[0] : rawContainer) as
      ContentstackReference | undefined;
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
