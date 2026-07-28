import { TestBed } from '@angular/core/testing';
import { CmsComponentAdapter, CmsPageAdapter } from '@spartacus/core';
import { ContentstackCmsModule } from './contentstack-cms.module';
import { ContentstackConfig } from '../config/contentstack-config';
import { ContentstackCmsPageAdapter } from './adapters/contentstack-cms-page.adapter';
import { ContentstackCmsComponentAdapter } from './adapters/contentstack-cms-component.adapter';

/**
 * Verifies the DI override: after importing ContentstackCmsModule, resolving the
 * abstract Spartacus CMS adapter tokens yields the Contentstack implementations.
 * This is what guarantees Spartacus loads CMS content from Contentstack, not OCC.
 */
describe('ContentstackCmsModule (DI wiring)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ContentstackCmsModule],
      providers: [
        {
          provide: ContentstackConfig,
          useValue: {
            contentstack: {
              delivery: {
                apiKey: 'k',
                deliveryToken: 't',
                environment: 'production',
              },
              cmsPageContentType: 'cms_page',
            },
          } as ContentstackConfig,
        },
      ],
    });
  });

  it('binds CmsPageAdapter to ContentstackCmsPageAdapter', () => {
    expect(TestBed.inject(CmsPageAdapter)).toBeInstanceOf(ContentstackCmsPageAdapter);
  });

  it('binds CmsComponentAdapter to ContentstackCmsComponentAdapter', () => {
    expect(TestBed.inject(CmsComponentAdapter)).toBeInstanceOf(ContentstackCmsComponentAdapter);
  });
});
