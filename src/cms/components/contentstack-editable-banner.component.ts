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
  /** Edit tag of the image's source field (set by the banner normalizer in preview builds). */
  mediaCslp?: string;
  $?: Record<string, { 'data-cslp'?: string } | undefined>;
}

/**
 * Connector-provided replacement for Spartacus's stock banner renderer that tags
 * the **image** with the field it comes from (`mediaCslp`, set by the banner
 * normalizer: the `media_container` entry's file, a `media_<breakpoint>` file or
 * the single `media` file). Clicking the picture in Visual Builder then edits that
 * image. The banner as a whole is selected through the slot-position tag the
 * component decorator puts on the host element.
 *
 * An earlier version tagged `url_link` on a wrapper covering the whole banner,
 * assuming Visual Builder rejects file-field tags. The "invalid CSLP tag" error
 * seen then came from the bare 3-part tag on the host (fixed with the slot
 * position tags), not from the file field.
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
    <div *ngIf="data$ | async as data">
      <cx-generic-link *ngIf="data.urlLink; else plain" [url]="data.urlLink">
        <cx-media
          [csEditable]="data.mediaCslp"
          [container]="$any(data.media)"
          [elementType]="'picture'"
        ></cx-media>
      </cx-generic-link>
      <ng-template #plain>
        <cx-media
          [csEditable]="data.mediaCslp"
          [container]="$any(data.media)"
          [elementType]="'picture'"
        ></cx-media>
      </ng-template>
    </div>
  `,
})
export class ContentstackEditableBannerComponent {
  protected readonly componentData: CmsComponentData<ContentstackEditableBannerData> =
    inject(CmsComponentData);

  /** Banner data stream from Contentstack (via the CMS store). */
  readonly data$: Observable<ContentstackEditableBannerData> = this.componentData.data$;
}
