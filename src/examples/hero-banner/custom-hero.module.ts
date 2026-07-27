import { NgModule } from '@angular/core';
import { CmsConfig, provideDefaultConfig } from '@spartacus/core';
import { CustomHeroComponent } from './custom-hero.component';

/**
 * EXAMPLE module showing how to map a Contentstack content/block type to an
 * Angular component via Spartacus `CmsConfig.cmsComponents`.
 *
 * The map **key must equal the `typeCode`** the page normalizer emits — i.e. the
 * Contentstack modular-block type key (here `contentstack_hero_banner`). When
 * Spartacus's `ComponentWrapperDirective` encounters a slot component with that
 * typeCode, it instantiates {@link CustomHeroComponent} and feeds it the entry's
 * fields through `CmsComponentData`.
 *
 * Import this in the consuming app (or copy the pattern) for each content type.
 */
@NgModule({
  imports: [CustomHeroComponent],
  providers: [
    provideDefaultConfig(<CmsConfig>{
      cmsComponents: {
        contentstack_hero_banner: {
          component: CustomHeroComponent,
        },
      },
    }),
  ],
})
export class CustomHeroModule {}
