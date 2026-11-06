import { Injectable, Renderer2, inject } from '@angular/core';
import { ContentSlotData, SlotDecorator } from '@spartacus/core';
import { VB_EmptyBlockParentClass } from '@contentstack/live-preview-utils';
import { ContentstackLivePreviewService } from './contentstack-live-preview.service';

/**
 * Ties into Spartacus's `SlotDecorator` extension point to tag each authored
 * slot element (`cx-page-slot`) with its Contentstack reference field
 * (`page_ct.uid.locale.field`). Together with the per-component `field.N` tags
 * (see `ContentstackComponentDecorator`) this is what Visual Builder needs to
 * reorder, add and delete components in a slot. An authored slot that is empty
 * also gets Visual Builder's empty-block class, which shows its "add" placeholder.
 *
 * The tag comes from `slot.properties.cslp`, set by the page normalizer only
 * when Live Preview is active, so delivery builds and OCC slots are untouched.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackSlotDecorator extends SlotDecorator {
  protected contentstackLivePreviewService = inject(ContentstackLivePreviewService);

  decorate(element: Element, renderer: Renderer2, slot: ContentSlotData): void {
    const tag = slot?.properties?.cslp as string | undefined;
    if (!tag) {
      return;
    }
    renderer.setAttribute(
      element,
      'data-cslp',
      this.contentstackLivePreviewService.forCurrentLocale(tag),
    );
    if (slot.components?.length) {
      renderer.removeClass(element, VB_EmptyBlockParentClass);
    } else {
      renderer.addClass(element, VB_EmptyBlockParentClass);
    }
  }
}
