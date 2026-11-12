import { Injectable } from '@angular/core';
import { CmsProductCarouselComponent, Converter } from '@spartacus/core';
import { ContentstackEntry } from '../../model/contentstack.model';
import { isString } from '../../model/type-guards';

/**
 * Resolves a product carousel's SKUs into Spartacus's `productCodes`, a single
 * space-separated string matching OCC's own delivery shape.
 *
 * Reads `sap_products` first — the SAP Commerce Cloud marketplace app's product
 * picker, which stores `{ type, data: [{ code, name, ... }] }` — and falls back
 * to `products`, the legacy multi-value TEXT field of SKUs or raw OCC product
 * URLs (`.split('/').pop()` extraction), when the picker field is empty.
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
    const codes = this.sapPickerCodes(source['sap_products']);
    const resolved = codes.length ? codes : this.legacyCodes(source['products']);
    if (resolved.length) {
      target.productCodes = resolved.join(' ');
    }
    return target;
  }

  private sapPickerCodes(field: unknown): string[] {
    const data = (field as { data?: unknown } | null | undefined)?.data;
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map((item) => (item as { code?: unknown } | null)?.code)
      .filter(isString)
      .filter((code) => !!code);
  }

  private legacyCodes(products: unknown): string[] {
    if (!Array.isArray(products)) {
      return [];
    }
    return products
      .filter(isString)
      .map((url) => url.split('/').pop())
      .filter((code): code is string => !!code);
  }
}
