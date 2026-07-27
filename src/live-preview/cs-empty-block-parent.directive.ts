import { Directive, ElementRef, Input, Renderer2 } from '@angular/core';
import { VB_EmptyBlockParentClass } from '@contentstack/live-preview-utils';

/**
 * Marks a slot container as an "empty block parent" for Contentstack Visual
 * Builder, so an empty slot renders VB's add-a-block placeholder / drop target
 * (the PRD's slot-based drag/drop/reorder editing). The connector can't apply
 * this itself — empty slots have no component to decorate, and slot containers
 * live in the consuming storefront's page/slot templates — so this directive is
 * the primitive the storefront attaches to each slot wrapper.
 *
 * Re-exports the SDK's class constant so the wrapper is tagged with exactly the
 * class Visual Builder looks for (`visual-builder__empty-block-parent`).
 *
 * Usage: `<div [csEmptyBlockParent]="slot.components">…components…</div>`
 * (marks the container only when the slot has no components).
 */
@Directive({
  selector: '[csEmptyBlockParent]',
  standalone: true,
})
export class CsEmptyBlockParentDirective {
  private readonly el: ElementRef<Element>;
  private readonly renderer: Renderer2;

  constructor(el: ElementRef<Element>, renderer: Renderer2) {
    this.el = el;
    this.renderer = renderer;
  }

  /** Accepts either the slot's components array (empty ⇒ mark) or a boolean. */
  @Input()
  set csEmptyBlockParent(value: unknown[] | boolean | null | undefined) {
    const isEmpty = Array.isArray(value) ? value.length === 0 : !!value;
    if (isEmpty) {
      this.renderer.addClass(this.el.nativeElement, VB_EmptyBlockParentClass);
    } else {
      this.renderer.removeClass(this.el.nativeElement, VB_EmptyBlockParentClass);
    }
  }
}

export { VB_EmptyBlockParentClass };
