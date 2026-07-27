import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ComponentDecorator } from '@spartacus/core';
import { ContentstackComponentDecorator } from './contentstack-component.decorator';

/**
 * EP3 — Live Preview / Visual Editor bindings. Registers the Contentstack
 * component decorator over Spartacus's `ComponentDecorator` extension point
 * (same DI "last-provider-wins" mechanism {@link ContentstackCmsModule} uses
 * for the CMS adapters). `CsEditableDirective` is `standalone: true` and
 * imported directly wherever it's used in a module component's own template —
 * it needs no declaration here.
 *
 * Imported by {@link ContentstackCmsFeatureModule}; not required if an app
 * only wants the EP1 CMS override without Live Preview/Visual Editor.
 */
@NgModule({
  imports: [CommonModule],
  // `ComponentDecorator` is a MULTI provider in Spartacus (ComponentWrapperDirective
  // injects `ComponentDecorator[]`), so the override must be registered with
  // `multi: true` — a plain single provider throws "Multi-providers mixed with
  // single providers for class ComponentDecorator" at render time.
  providers: [{ provide: ComponentDecorator, useExisting: ContentstackComponentDecorator, multi: true }],
})
export class ContentstackLivePreviewModule {}
