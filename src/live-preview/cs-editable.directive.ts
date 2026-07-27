import { Directive, ElementRef, Input, Renderer2 } from '@angular/core';

/**
 * Reusable Angular directive wrapping `addEditableTags()` output, so module
 * authors don't hand-wire `data-cslp` bindings per field. Angular templates
 * can't spread JSX-style props (`{...entry.$.title}`), so this directive is
 * the reusable equivalent of hand-binding
 * `[attr.data-cslp]="entry.$?.title?.['data-cslp']"` on every field across
 * every module component — the same constraint `kickstart-angular` works
 * around by hand-binding per element.
 *
 * Usage (top-level field): `<h1 [csEditable]="entry.$?.title">{{ entry.title }}</h1>`
 * Usage (nested modular-block field): `<div [csEditable]="entry.$?.blocks__0">...</div>`
 *
 * Accepts the tag value already produced by `ContentstackLivePreviewService.tagEntry()`
 * (i.e. `entry.$[fieldUid]`), which is either a `{ 'data-cslp': string }` object
 * (tagsAsObject mode, what this connector uses) or a plain string.
 */
@Directive({
  selector: '[csEditable]',
  standalone: true,
})
export class CsEditableDirective {
  private readonly el: ElementRef<Element>;
  private readonly renderer: Renderer2;

  constructor(el: ElementRef<Element>, renderer: Renderer2) {
    this.el = el;
    this.renderer = renderer;
  }

  @Input()
  set csEditable(tag: { 'data-cslp'?: string } | string | undefined | null) {
    const value = typeof tag === 'string' ? tag : tag?.['data-cslp'];
    if (value) {
      this.renderer.setAttribute(this.el.nativeElement, 'data-cslp', value);
    } else {
      this.renderer.removeAttribute(this.el.nativeElement, 'data-cslp');
    }
  }
}
