import { Injectable } from '@angular/core';
import { CmsProductCarouselComponent, Converter } from '@spartacus/core';
import { ContentstackEntry } from '../../model/contentstack.model';
import { isString } from '../../model/type-guards';

/**
 * Resolves `product_carousel_component.products` — a multi-value TEXT field of
 * raw OCC product-URL strings (fixed from an earlier incorrect reference-type
 * cast) — into Spartacus's `productCodes`, a single
 * space-separated string of SKUs, matching OCC's own delivery shape via a
 * `.split('/').pop()` extraction.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsProductCarouselComponentNormalizer implements Converter<
  ContentstackEntry,
  CmsProductCarouselComponent
> {
  convert(
    source: ContentstackEntry,
    target: CmsProductCarouselComponent = {},
  ): CmsProductCarouselComponent {
    // Heading above the carousel (Contentstack `title`). Spartacus's
    // `CmsProductCarouselComponent` renders `title`, but this normalizer
    // previously dropped it — so an authored heading (or a Personalize variant
    // that overrides only the heading) never showed. Map it through when present.
    if (isString(source['title'])) {
      target.title = source['title'];
    }
    const products = source['products'];
    if (Array.isArray(products)) {
      const codes = products
        .filter(isString)
        .map((url) => url.split('/').pop())
        .filter((code): code is string => !!code);
      if (codes.length) {
        target.productCodes = codes.join(' ');
      }
    }
    return target;
  }
}
