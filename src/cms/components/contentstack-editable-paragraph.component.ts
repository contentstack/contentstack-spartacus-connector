import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { CmsComponent } from '@spartacus/core';
import { CmsComponentData } from '@spartacus/storefront';
import { CsEditableDirective } from '../../live-preview/cs-editable.directive';
import { classifyParagraphHref, headingAnchorIds } from './paragraph-links';

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
 * Registered by {@link ContentstackEditableComponentsModule} (on by default via
 * {@link ContentstackCmsFeatureModule}). Renders
 * identically to the stock paragraph (same `cx-paragraph` host class + innerHTML
 * content); the only addition is the edit tag, which is inert outside preview
 * builds (no `$` ⇒ CsEditableDirective removes the attribute).
 *
 * Links: the stock paragraph routes internal links in-app and keeps `#hash`
 * links on the page, but it needs `bypassSecurityTrustHtml` for that. This
 * renderer keeps Angular's sanitizer on (which also strips `id`), so it restores
 * the behaviour itself: a click on a root-relative link goes through the
 * `Router`, a `#hash` link scrolls to its target without leaving the page, and
 * headings get a generated anchor id (the slug of their text, `-2`, `-3`, ... on
 * repeats), so an author can link `#details` to a heading named "Details".
 */
@Component({
  selector: 'cs-editable-paragraph',
  standalone: true,
  imports: [CommonModule, CsEditableDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onClick($event)' },
  template: `
    <div
      *ngIf="data$ | async as data"
      class="cx-paragraph"
      [csEditable]="data.$?.['content']"
      [innerHTML]="data.content"
    ></div>
  `,
})
export class ContentstackEditableParagraphComponent implements AfterViewChecked {
  protected readonly componentData: CmsComponentData<ContentstackEditableParagraphData> =
    inject(CmsComponentData);

  /** Paragraph content stream from Contentstack (via the CMS store). */
  readonly data$: Observable<ContentstackEditableParagraphData> = this.componentData.data$;

  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private anchoredHtml: string | null = null;

  /** Adds generated anchor ids to headings after the sanitized HTML is rendered. */
  ngAfterViewChecked(): void {
    const el = this.host.nativeElement.querySelector('.cx-paragraph');
    if (!el || el.innerHTML === this.anchoredHtml) {
      return;
    }
    const headings = Array.from(el.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
    const ids = headingAnchorIds(headings.map((h) => h.textContent ?? ''));
    headings.forEach((h, i) => {
      const id = ids[i];
      if (id) {
        h.id = id;
      }
    });
    this.anchoredHtml = el.innerHTML;
  }

  /** In-app routing for internal links; same-page scrolling for `#hash` links. */
  onClick(event: MouseEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = (event.target as Element | null)?.closest?.('a');
    if (!anchor || (anchor.target && anchor.target !== '_self')) {
      return;
    }
    const action = classifyParagraphHref(anchor.getAttribute('href'));
    if (!action) {
      return;
    }
    event.preventDefault();
    if (action.kind === 'internal') {
      void this.router.navigateByUrl(action.url);
    } else {
      anchor.ownerDocument.getElementById(action.id)?.scrollIntoView?.();
    }
  }
}
