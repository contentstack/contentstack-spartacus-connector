import { Injectable, Renderer2 } from '@angular/core';
import { ComponentDecorator, ContentSlotComponentData } from '@spartacus/core';
import { ContentstackLivePreviewService } from './contentstack-live-preview.service';

/**
 * Ties into Spartacus's `ComponentDecorator` extension point to tag each
 * rendered component element with its position in the page's slot field
 * (`page_ct.uid.locale.field.N`). Visual Builder reads that as item N of the
 * slot's reference field, which gives component selection, open-entry, move,
 * duplicate and delete. The tag is valid on stock Spartacus components and on
 * the connector's `<cs-editable-*>` renderers, whose own field-level tags
 * (`CsEditableDirective`) sit inside it. OCC-rendered components get no tag.
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
    this.contentstackLivePreviewService.addInspectorModeTags(element, renderer, component);
  }
}
