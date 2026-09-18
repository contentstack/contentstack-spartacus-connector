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
    // Do NOT stamp the coarse tag on our own editable renderers (`<cs-editable-*>`).
    // That coarse tag is a bare 3-part `content_type.entry.locale` string, which is
    // NOT a valid Contentstack CSLP tag — the SDK only ever emits field-scoped
    // (4-part) tags. On an editable renderer, Visual Builder therefore reports
    // "Invalid CSLP tag" for the host. These renderers instead carry a VALID
    // field-level tag on their section wrapper (via CsEditableDirective), which
    // both clears the error and provides the open-the-entry affordance.
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
