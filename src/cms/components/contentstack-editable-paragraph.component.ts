import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CmsComponent } from '@spartacus/core';
import { CmsComponentData } from '@spartacus/storefront';
import { CsEditableDirective } from '../../live-preview/cs-editable.directive';

/**
 * The `data` shape this component reads out of `CmsComponentData` for a
 * `CMSParagraphComponent`. `content` is the rendered rich text (same field the
 * stock Spartacus `ParagraphComponent` reads); `$` is the Live Preview field-tag
 * map preserved by {@link ContentstackCmsComponentNormalizer} (present only on
 * preview builds).
 */
export interface ContentstackEditableParagraphData extends CmsComponent {
  content?: string;
  $?: Record<string, { 'data-cslp'?: string } | undefined>;
}

/**
 * A drop-in, connector-provided replacement for Spartacus's stock paragraph
 * renderer that additionally emits a **field-level** `data-cslp` tag on the
 * content, so Contentstack's Visual Builder can inline-edit seeded
 * `cms_paragraph_component` content.
 *
 * Why this exists: the stock `ParagraphComponent` is owned by Spartacus, so the
 * connector can only stamp a coarse **entry-level** tag on its wrapper (via the
 * ComponentDecorator). Visual Builder needs a field-level tag
 * (`{content_type}.{entry}.{locale}.content`) to edit a field, and reports an
 * "Invalid CSLP tag" for the entry-level-only tag. Rendering the paragraph here
 * — with `[csEditable]` bound to `data.$.content` — produces that field tag.
 *
 * Registered (opt-in) by {@link ContentstackEditableComponentsModule}. Renders
 * identically to the stock paragraph (same `cx-paragraph` host class + innerHTML
 * content); the only addition is the edit tag, which is inert outside preview
 * builds (no `$` ⇒ CsEditableDirective removes the attribute).
 */
@Component({
  selector: 'cs-editable-paragraph',
  standalone: true,
  imports: [CommonModule, CsEditableDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      *ngIf="data$ | async as data"
      class="cx-paragraph"
      [csEditable]="data.$?.['content']"
      [innerHTML]="data.content"
    ></div>
  `,
})
export class ContentstackEditableParagraphComponent {
  protected readonly componentData: CmsComponentData<ContentstackEditableParagraphData> =
    inject(CmsComponentData);

  /** Paragraph content stream from Contentstack (via the CMS store). */
  readonly data$: Observable<ContentstackEditableParagraphData> = this.componentData.data$;
}
