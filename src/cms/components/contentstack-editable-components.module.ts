import { NgModule } from '@angular/core';
import { CmsConfig, provideConfig } from '@spartacus/core';
import { ContentstackEditableParagraphComponent } from './contentstack-editable-paragraph.component';

/**
 * Swaps Spartacus's stock renderers for connector-owned ones that emit
 * **field-level** `data-cslp` tags, so seeded Contentstack component types become
 * inline-editable in the Visual Builder (instead of only carrying the coarse
 * entry-level tag that Visual Builder flags as an invalid / incorrectly-generated
 * CSLP tag).
 *
 * Imported by {@link ContentstackCmsFeatureModule} by default, so consuming apps
 * get this automatically with no extra wiring. It is safe on by default: the
 * editable renderers render identically to the stock Spartacus components, and
 * the edit tags are inert outside preview builds (no `entry.$` ⇒ the directive
 * removes the attribute), so normal delivery/production rendering is unchanged.
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
