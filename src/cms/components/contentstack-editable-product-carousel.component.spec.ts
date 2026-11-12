import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProductService } from '@spartacus/core';
import { CmsComponentData } from '@spartacus/storefront';
import { CsEditableDirective } from '../../live-preview/cs-editable.directive';
import {
  ContentstackEditableProductCarouselComponent,
  ContentstackEditableProductCarouselData,
} from './contentstack-editable-product-carousel.component';

/**
 * Guards the Visual Builder bindings: the title wrapper carries the `title` tag
 * and the product list carries the SAP picker's `sap_products` tag (falling back
 * to legacy `products`), so clicking the products opens the picker. The stock
 * carousel modules are swapped for a custom-elements schema — only the tags and
 * the product hydration call are under test here.
 */
describe('ContentstackEditableProductCarouselComponent', () => {
  const TITLE_TAG = 'product_carousel_component.blt1.en-us.title';
  const SAP_TAG = 'product_carousel_component.blt1.en-us.sap_products';
  const LEGACY_TAG = 'product_carousel_component.blt1.en-us.products';
  let productService: { get: jest.Mock };

  async function render(
    data: ContentstackEditableProductCarouselData,
  ): Promise<ComponentFixture<ContentstackEditableProductCarouselComponent>> {
    productService = { get: jest.fn((code: string) => of({ code })) };
    await TestBed.configureTestingModule({
      imports: [ContentstackEditableProductCarouselComponent],
      providers: [
        { provide: CmsComponentData, useValue: { uid: 'blt1', data$: of(data) } },
        { provide: ProductService, useValue: productService },
      ],
    })
      .overrideComponent(ContentstackEditableProductCarouselComponent, {
        set: { imports: [CommonModule, CsEditableDirective], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ContentstackEditableProductCarouselComponent);
    fixture.detectChanges();
    return fixture;
  }

  const products = (fixture: ComponentFixture<unknown>) =>
    fixture.nativeElement.querySelector('.cs-editable-carousel-products') as HTMLElement;

  afterEach(() => TestBed.resetTestingModule());

  it('tags the product list with the sap_products field and the wrapper with title', async () => {
    const fixture = await render({
      title: 'Bestsellers',
      productCodes: '300938 358639',
      $: {
        title: { 'data-cslp': TITLE_TAG },
        sap_products: { 'data-cslp': SAP_TAG },
        products: { 'data-cslp': LEGACY_TAG },
      },
    });
    const wrapper = fixture.nativeElement.querySelector('.cs-editable-carousel') as HTMLElement;
    expect(wrapper.getAttribute('data-cslp')).toBe(TITLE_TAG);
    expect(products(fixture).getAttribute('data-cslp')).toBe(SAP_TAG);
    expect(productService.get.mock.calls.map(([code]) => code)).toEqual(['300938', '358639']);
  });

  it('falls back to the legacy products tag when the entry has no sap_products field', async () => {
    const fixture = await render({
      productCodes: '1934793',
      $: { products: { 'data-cslp': LEGACY_TAG } },
    });
    expect(products(fixture).getAttribute('data-cslp')).toBe(LEGACY_TAG);
  });

  it('renders no data-cslp on the product list when the entry is untagged (delivery)', async () => {
    const fixture = await render({ productCodes: '300938' });
    expect(products(fixture).hasAttribute('data-cslp')).toBe(false);
  });
});
