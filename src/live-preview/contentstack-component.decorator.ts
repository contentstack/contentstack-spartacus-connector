import { Injectable, Renderer2 } from '@angular/core';
import { ComponentDecorator, ContentSlotComponentData } from '@spartacus/core';
import { ContentstackLivePreviewService } from './contentstack-live-preview.service';

/**
 * Ties into Spartacus's `ComponentDecorator` extension point to apply a
 * coarse, whole-entry `data-cslp` tag on each rendered component wrapper —
 * satisfying component-to-entry navigation (the PRD's Inspector-Mode
 * equivalent). Fine-grained per-field editing within a component's own
 * template is a separate concern, handled by `CsEditableDirective`, since
 * Contentstack's Visual Builder tags individual fields, not whole components.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackComponentDecorator extends ComponentDecorator {
  constructor(protected contentstackLivePreviewService: ContentstackLivePreviewService) {
    super();
  }

  decorate(element: Element, renderer: Renderer2, component: ContentSlotComponentData): void {
    if (!component) {
      return;
    }
    if (!this.contentstackLivePreviewService.hasEditableTags(element)) {
      this.contentstackLivePreviewService.addInspectorModeTags(element, renderer, component);
    }
  }
}
