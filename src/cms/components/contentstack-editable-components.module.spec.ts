import { TestBed } from '@angular/core/testing';
import { Config, ConfigModule } from '@spartacus/core';
import { ContentstackEditableComponentsModule } from './contentstack-editable-components.module';
import { ContentstackEditableParagraphComponent } from './contentstack-editable-paragraph.component';
import { ContentstackEditableBannerComponent } from './contentstack-editable-banner.component';
import { ContentstackEditableProductCarouselComponent } from './contentstack-editable-product-carousel.component';

/**
 * Registration check for the connector's editable renderers: the tab paragraph
 * typeCode must resolve to the editable paragraph renderer, and the existing
 * registrations must be unchanged.
 */
describe('ContentstackEditableComponentsModule (cmsComponents registrations)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConfigModule.forRoot(), ContentstackEditableComponentsModule],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  function cmsComponents(): Record<string, { component?: unknown }> {
    return (TestBed.inject(Config) as { cmsComponents?: Record<string, { component?: unknown }> })
      .cmsComponents as Record<string, { component?: unknown }>;
  }

  it('maps CMSTabParagraphComponent to ContentstackEditableParagraphComponent', () => {
    expect(cmsComponents()['CMSTabParagraphComponent']?.component).toBe(
      ContentstackEditableParagraphComponent,
    );
  });

  it('keeps the existing registrations unchanged', () => {
    const registry = cmsComponents();
    expect(registry['CMSParagraphComponent']?.component).toBe(
      ContentstackEditableParagraphComponent,
    );
    expect(registry['SimpleBannerComponent']?.component).toBe(ContentstackEditableBannerComponent);
    expect(registry['SimpleResponsiveBannerComponent']?.component).toBe(
      ContentstackEditableBannerComponent,
    );
    expect(registry['ProductCarouselComponent']?.component).toBe(
      ContentstackEditableProductCarouselComponent,
    );
  });
});
