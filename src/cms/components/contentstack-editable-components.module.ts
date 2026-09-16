import { NgModule } from '@angular/core';
import { CmsConfig, provideConfig } from '@spartacus/core';
import { ContentstackEditableParagraphComponent } from './contentstack-editable-paragraph.component';

/**
 * **Opt-in** module that swaps Spartacus's stock renderers for connector-owned
 * ones that emit **field-level** `data-cslp` tags, so seeded Contentstack
 * component types become inline-editable in the Visual Builder (instead of only
 * carrying the coarse entry-level tag that Visual Builder flags as an invalid /
 * incorrectly-generated CSLP tag).
 *
 * Import it in your app **after** `ContentstackCmsFeatureModule` to opt in:
 *
 * ```ts
 * imports: [ContentstackCmsFeatureModule, ContentstackEditableComponentsModule]
 * ```
 *
 * It is deliberately NOT pulled in by `ContentstackCmsFeatureModule`, so the
 * default behavior (stock Spartacus rendering) is unchanged for apps that don't
 * opt in. The edit tags are inert outside preview builds, so opting in is safe
 * for production too.
 *
 * Currently covers `CMSParagraphComponent`; banner and product-carousel are
 * intentionally left to follow-up work (the carousel additionally hydrates live
 * SAP product data, which its editable renderer must preserve).
 */
@NgModule({
  providers: [
    provideConfig({
      cmsComponents: {
        CMSParagraphComponent: {
          component: ContentstackEditableParagraphComponent,
        },
      },
    } as CmsConfig),
  ],
})
export class ContentstackEditableComponentsModule {}
