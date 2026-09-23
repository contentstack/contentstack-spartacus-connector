import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CmsProductCarouselComponent,
  Product,
  ProductScope,
  ProductService,
} from '@spartacus/core';
import { CarouselModule, CmsComponentData, ProductCarouselModule } from '@spartacus/storefront';
import { CsEditableDirective } from '../../live-preview/cs-editable.directive';

/**
 * The `data` shape read from `CmsComponentData` for a product carousel. `title`
 * and `productCodes` (space-separated SKUs) are produced by the connector's
 * field mapper + carousel normalizer; `$` is the Live Preview field-tag map
 * preserved by {@link ContentstackCmsComponentNormalizer} (preview builds only).
 */
export interface ContentstackEditableProductCarouselData extends CmsProductCarouselComponent {
  title?: string;
  productCodes?: string;
  $?: Record<string, { 'data-cslp'?: string } | undefined>;
}

/**
 * Connector-provided replacement for Spartacus's stock product-carousel renderer
 * that makes the carousel **title** inline-editable in Contentstack's Visual
 * Builder, while **preserving the live SAP product hydration**.
 *
 * The stock `ProductCarouselComponent` renders its title *inside* `cx-carousel`
 * (via the `[title]` input), so it can't be field-tagged there. This component
 * instead wraps the whole section in a `<div>` carrying the `title` field's VALID
 * 4-part `data-cslp` (`[csEditable]` → `title`), renders its own `<h3>` heading,
 * and passes an empty title to `cx-carousel` to avoid a duplicate heading.
 *
 * The section-wrapper tag (not the coarse entry-level host tag, which the
 * ComponentDecorator deliberately skips for `<cs-editable-*>` hosts) is what
 * makes the section selectable/openable in Visual Builder WITHOUT the "Invalid
 * CSLP tag" error — a single valid field tag, no conflicting bare 3-part tag.
 *
 * The products themselves are unchanged: each SKU in `productCodes` is hydrated
 * live from SAP via Spartacus's `ProductService` (same `LIST`+`STOCK` scopes as
 * the stock component) and rendered with the stock `cx-product-carousel-item`, so
 * price/stock/name/image and add-to-cart all keep coming from SAP OCC.
 *
 * Registered by {@link ContentstackEditableComponentsModule} (on by default via
 * {@link ContentstackCmsFeatureModule}). The edit tag is inert outside preview
 * builds (no `$` ⇒ CsEditableDirective removes the attribute).
 */
@Component({
  selector: 'cs-editable-product-carousel',
  standalone: true,
  imports: [CommonModule, CarouselModule, ProductCarouselModule, CsEditableDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      *ngIf="data$ | async as data"
      class="cs-editable-carousel"
      [csEditable]="data.$?.['title']"
    >
      <h3 *ngIf="data.title" class="cs-editable-carousel-title">
        {{ data.title }}
      </h3>
      <cx-carousel
        *ngIf="items$ | async as items"
        [items]="items"
        [template]="carouselItem"
        itemWidth="285px"
        [title]="''"
      ></cx-carousel>
    </div>

    <ng-template #carouselItem let-item="item" let-itemIndex="itemIndex">
      <cx-product-carousel-item [item]="item" [itemIndex]="itemIndex"></cx-product-carousel-item>
    </ng-template>
  `,
})
export class ContentstackEditableProductCarouselComponent {
  protected readonly componentData: CmsComponentData<ContentstackEditableProductCarouselData> =
    inject(CmsComponentData);
  protected readonly productService = inject(ProductService);

  readonly data$: Observable<ContentstackEditableProductCarouselData> = this.componentData.data$;

  /**
   * One live SAP product stream per SKU — preserves the connector's hydration:
   * `productCodes` (space-separated) → `ProductService.get(code, [LIST, STOCK])`,
   * exactly the scopes the stock ProductCarouselComponent uses.
   */
  readonly items$: Observable<Observable<Product | undefined>[]> = this.data$.pipe(
    map((data) =>
      (data.productCodes ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => this.productService.get(code, [ProductScope.LIST, ProductScope.STOCK])),
    ),
  );
}
