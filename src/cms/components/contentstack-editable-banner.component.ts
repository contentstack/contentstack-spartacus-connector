import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CmsBannerComponent } from '@spartacus/core';
import { CmsComponentData, GenericLinkModule, MediaModule } from '@spartacus/storefront';
import { CsEditableDirective } from '../../live-preview/cs-editable.directive';

/**
 * The `data` shape read from `CmsComponentData` for a banner. `media` (the
 * responsive breakpoint set) and `urlLink` are what the stock Spartacus
 * `BannerComponent` reads; `$` is the Live Preview field-tag map preserved by
 * {@link ContentstackCmsComponentNormalizer} (present only on preview builds).
 */
export interface ContentstackEditableBannerData extends CmsBannerComponent {
  urlLink?: string;
  $?: Record<string, { 'data-cslp'?: string } | undefined>;
}

/**
 * Connector-provided replacement for Spartacus's stock banner renderer that adds
 * a **field-level** `data-cslp` tag on the image, so Contentstack's Visual
 * Builder can edit the banner's `media` (image) field inline — instead of the
 * component only carrying the coarse entry-level tag it flags as invalid.
 *
 * Renders the same building blocks as the stock banner — Spartacus's `cx-media`
 * (responsive image) inside `cx-generic-link` (SPA-aware link) — so the visual
 * output and routing behavior are unchanged; the only addition is the edit tag,
 * which is inert outside preview builds (no `$` ⇒ CsEditableDirective removes the
 * attribute). Registered by {@link ContentstackEditableComponentsModule} for the
 * banner typeCodes, on by default via {@link ContentstackCmsFeatureModule}.
 */
@Component({
  selector: 'cs-editable-banner',
  standalone: true,
  imports: [CommonModule, MediaModule, GenericLinkModule, CsEditableDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngIf="data$ | async as data">
      <cx-generic-link *ngIf="data.urlLink; else plain" [url]="data.urlLink">
        <cx-media
          [container]="$any(data.media)"
          [elementType]="'picture'"
          [csEditable]="data.$?.['media']"
        ></cx-media>
      </cx-generic-link>
      <ng-template #plain>
        <cx-media
          [container]="$any(data.media)"
          [elementType]="'picture'"
          [csEditable]="data.$?.['media']"
        ></cx-media>
      </ng-template>
    </ng-container>
  `,
})
export class ContentstackEditableBannerComponent {
  protected readonly componentData: CmsComponentData<ContentstackEditableBannerData> =
    inject(CmsComponentData);

  /** Banner data stream from Contentstack (via the CMS store). */
  readonly data$: Observable<ContentstackEditableBannerData> = this.componentData.data$;
}
