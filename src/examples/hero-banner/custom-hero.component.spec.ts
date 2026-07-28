import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Product, ProductScope, ProductService } from '@spartacus/core';
import { CmsComponentData } from '@spartacus/storefront';
import { ActiveCartFacade } from '@spartacus/cart/base/root';
import { CustomHeroComponent } from './custom-hero.component';
import { ContentstackHeroData } from './hero.model';

class MockProductService {
  get = jasmine.createSpy('get').and.returnValue(
    of<Product>({
      code: '3755230',
      name: 'Cordless Drill',
      price: { formattedValue: '$149.00' },
      stock: { stockLevelStatus: 'inStock' },
    }),
  );
}

class MockActiveCartFacade {
  addEntry = jasmine.createSpy('addEntry');
}

describe('CustomHeroComponent (hydration example)', () => {
  let fixture: ComponentFixture<CustomHeroComponent>;
  let productService: MockProductService;
  let activeCart: MockActiveCartFacade;

  const heroData: ContentstackHeroData = {
    uid: 'blk_hero_1',
    typeCode: 'hero_banner',
    headline: 'Power through any job',
    subline: 'Pro-grade cordless tools',
    ctaLabel: 'Shop now',
    product: { code: '3755230' },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomHeroComponent],
      providers: [
        {
          provide: CmsComponentData,
          useValue: { uid: 'blk_hero_1', data$: of(heroData) },
        },
        { provide: ProductService, useClass: MockProductService },
        { provide: ActiveCartFacade, useClass: MockActiveCartFacade },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomHeroComponent);
    productService = TestBed.inject(ProductService) as unknown as MockProductService;
    activeCart = TestBed.inject(ActiveCartFacade) as unknown as MockActiveCartFacade;
    fixture.detectChanges();
  });

  it('renders Contentstack copy alongside live SAP product data', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.cs-hero__headline')?.textContent).toContain('Power through any job');
    // Product name + price come from the (mocked) SAP ProductService.
    expect(el.querySelector('.cs-hero__product-name')?.textContent).toContain('Cordless Drill');
    expect(el.querySelector('.cs-hero__product-price')?.textContent).toContain('$149.00');
    expect(productService.get).toHaveBeenCalledWith('3755230', ProductScope.DETAILS);
  });

  it('adds the hydrated SAP product to the cart', () => {
    fixture.componentInstance.addToCart('3755230');
    expect(activeCart.addEntry).toHaveBeenCalledWith('3755230', 1);
  });
});
