import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CmsComponentAdapter, CmsPageAdapter } from '@spartacus/core';
import { ContentstackCmsPageAdapter } from './adapters/contentstack-cms-page.adapter';
import { ContentstackCmsComponentAdapter } from './adapters/contentstack-cms-component.adapter';

/**
 * Swaps the SAP OCC CMS source for Contentstack.
 *
 * `CmsOccModule` (part of the Spartacus base) binds:
 *   { provide: CmsPageAdapter,      useExisting: OccCmsPageAdapter }
 *   { provide: CmsComponentAdapter, useExisting: OccCmsComponentAdapter }
 *
 * By re-providing the same abstract tokens here — and importing this module
 * *after* the OCC bindings — Angular DI's "last provider wins" rule routes every
 * CMS page/component load through our Contentstack adapters instead. Nothing
 * upstream changes: `CmsPageConnector`, the CMS NgRx store, and the rendering
 * engine all depend only on the abstract `CmsPageAdapter` / `CmsComponentAdapter`.
 *
 * Note: we intentionally do NOT register `CMS_PAGE_NORMALIZER` /
 * `CMS_COMPONENT_NORMALIZER` here. Those are multi tokens already carrying the
 * OCC normalizers; adding ours would run the OCC transform over Contentstack
 * JSON. Our adapters call the Contentstack normalizers directly instead.
 */
@NgModule({
  imports: [CommonModule],
  providers: [
    { provide: CmsPageAdapter, useExisting: ContentstackCmsPageAdapter },
    { provide: CmsComponentAdapter, useExisting: ContentstackCmsComponentAdapter },
  ],
})
export class ContentstackCmsModule {}
