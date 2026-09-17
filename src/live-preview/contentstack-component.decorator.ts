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
    // Skip the coarse entry-level tag on our own editable renderers
    // (`<cs-editable-*>`). Those emit **field-level** (4-part) `data-cslp` tags
    // on the fields inside their templates via `CsEditableDirective`; leaving a
    // lone **entry-level** (3-part) tag on the host as well makes Visual Builder
    // report "Invalid CSLP tag" for the whole component (a bare 3-part tag on
    // the host is not inline-editable). The inner field tag already lets VB
    // resolve and open the entry, so component-to-entry navigation is preserved.
    if (this.isEditableRenderer(element)) {
      return;
    }
    if (!this.contentstackLivePreviewService.hasEditableTags(element)) {
      this.contentstackLivePreviewService.addInspectorModeTags(element, renderer, component);
    }
  }

  /** True for the connector's editable renderer hosts (`<cs-editable-*>`). */
  protected isEditableRenderer(element: Element): boolean {
    return element.tagName.toLowerCase().startsWith('cs-editable-');
  }
}
