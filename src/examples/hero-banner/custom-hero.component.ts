import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Product, ProductScope, ProductService } from '@spartacus/core';
import { CmsComponentData } from '@spartacus/storefront';
import { ActiveCartFacade } from '@spartacus/cart/base/root';
import { ContentstackHeroData } from './hero.model';

/**
 * EXAMPLE component — NOT part of the framework. It exists to demonstrate the
 * hydration pattern (Deliverable 4): a storefront component that renders
 * marketing content authored in **Contentstack** alongside **live commerce data
 * from SAP**.
 *
 * The decoupling in one component:
 *  - Contentstack (via `CmsComponentData.data$`) supplies the copy + the chosen
 *    SAP product's SKU (stored by the SAP Commerce Cloud Connector Marketplace
 *    app — SKU only, no price/stock).
 *  - SAP OCC (via Spartacus `ProductService`) supplies the live name, price, and
 *    stock for that SKU at render time.
 *  - Add-to-cart goes straight to SAP through `ActiveCartFacade`.
 *
 * Mapped to the Contentstack block type `contentstack_hero_banner` in
 * {@link CustomHeroModule}. Real projects add one such component per content
 * type in the *consuming app*, not in this library.
 */
@Component({
  selector: 'cs-custom-hero',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cs-hero" *ngIf="data$ | async as data">
      <!-- Content from Contentstack -->
      <div class="cs-hero__content">
        <h1 class="cs-hero__headline">{{ data.headline }}</h1>
        <p class="cs-hero__subline" *ngIf="data.subline">{{ data.subline }}</p>
      </div>

      <!-- Live commerce data from SAP, hydrated by SKU -->
      <div class="cs-hero__product" *ngIf="product$ | async as product">
        <span class="cs-hero__product-name">{{ product.name }}</span>
        <span class="cs-hero__product-price" *ngIf="product.price as price">
          {{ price.formattedValue }}
        </span>
        <span class="cs-hero__product-stock" *ngIf="product.stock?.stockLevelStatus as stockStatus">
          {{ stockStatus }}
        </span>
        <button
          type="button"
          class="cs-hero__cta"
          [disabled]="product.stock?.stockLevelStatus === 'outOfStock'"
          (click)="addToCart(product.code)"
        >
          {{ data.ctaLabel || 'Add to cart' }}
        </button>
      </div>
    </section>
  `,
})
export class CustomHeroComponent {
  /** Contentstack content for this hero instance, injected by Spartacus. */
  protected readonly componentData: CmsComponentData<ContentstackHeroData> =
    inject(CmsComponentData);
  protected readonly productService = inject(ProductService);
  protected readonly activeCart = inject(ActiveCartFacade);

  /** Marketing content stream from Contentstack. */
  readonly data$: Observable<ContentstackHeroData> = this.componentData.data$;

  /**
   * Live product stream from SAP. Reads the SKU that Contentstack stored on the
   * entry, then subscribes to Spartacus's `ProductService` for real-time detail.
   * A missing/empty SKU yields `undefined` (content-only hero, no product block).
   */
  readonly product$: Observable<Product | undefined> = this.data$.pipe(
    switchMap((data) =>
      data?.product?.code
        ? this.productService.get(data.product.code, ProductScope.DETAILS)
        : of(undefined),
    ),
  );

  /** Add the hydrated SAP product to the active cart. */
  addToCart(code?: string): void {
    if (code) {
      this.activeCart.addEntry(code, 1);
    }
  }
}
