import { Injectable } from '@angular/core';
import {
  CmsActions,
  CmsComponent,
  ContentSlotComponentData,
  LanguageService,
  PageContext,
  RoutingService,
  StateWithCms,
} from '@spartacus/core';
import { Store } from '@ngrx/store';
import type { EntryModel } from '@contentstack/utils';
import { take } from 'rxjs/operators';
import { ContentstackConfig } from '../config/contentstack-config';
import { ContentstackCmsPageAdapter } from '../cms/adapters/contentstack-cms-page.adapter';
import { ContentstackClientService } from '../client/contentstack-client.service';
import { ContentstackAngularService } from './contentstack-angular.service';

/**
 * Decorator-facing wrapper around {@link ContentstackAngularService} — the
 * Live Preview / Visual Editor counterpart to `ContentstackCmsModule`.
 * Initializes the Live Preview SDK once per app bootstrap (subscribed to the
 * active language, matching the `kickstart-angular` precedent) and, on every
 * Contentstack edit, re-fetches the current page and pushes the updated
 * component data into the CMS NgRx store so the storefront reflects the change
 * with no refresh or redeploy (PRD "Live Updates").
 */
@Injectable({ providedIn: 'root' })
export class ContentstackLivePreviewService {
  private customRefetch: (() => void) | undefined;

  constructor(
    protected contentstackAngularService: ContentstackAngularService,
    protected config: ContentstackConfig,
    protected store: Store<StateWithCms>,
    protected routingService: RoutingService,
    protected languageService: LanguageService,
    protected pageAdapter: ContentstackCmsPageAdapter,
    protected client: ContentstackClientService,
  ) {
    // Only initialize the Live Preview SDK when live preview is actually
    // enabled (a preview build). Otherwise this service stays inert, so the
    // eagerly-loaded module adds no preview behavior to normal delivery builds.
    if (!this.config.contentstack?.delivery?.livePreview) {
      return;
    }
    // Initialize the Live Preview SDK ONCE, with the language active at preview
    // start. `ContentstackAngularService.init` is guarded against re-init, and
    // the SDK does not cleanly support switching locale mid-session — so a
    // preview session is single-locale. `take(1)` makes that explicit rather
    // than subscribing to every language change and silently no-opping.
    this.languageService
      .getActive()
      .pipe(take(1))
      .subscribe((language) => {
        const delivery = this.config.contentstack?.delivery;
        this.contentstackAngularService.init({
          apiKey: delivery?.apiKey ?? '',
          environment: delivery?.environment ?? '',
          branch: delivery?.branch ?? 'main',
          locale: language,
          ssr: false,
          mode: 'builder',
        });
        // On any edit in the Visual Builder, re-fetch + re-dispatch (or defer to
        // an app-provided override). Contentstack's `onEntryChange` is a single
        // global, argument-less callback (see ContentstackAngularService) — it
        // does not say WHAT changed, so we reload the whole current page.
        this.contentstackAngularService.onEntryChange(() =>
          this.customRefetch ? this.customRefetch() : this.refetchCurrentPage(),
        );
      });
  }

  /**
   * Override the default "re-fetch current page → dispatch components" behavior
   * with a custom handler (rarely needed). Contentstack's `onEntryChange` has
   * no per-entry variant, so this is a single global hook.
   */
  registerRefetch(refetch: () => void): void {
    this.customRefetch = refetch;
  }

  /**
   * Default Live Updates handler: re-run the page adapter for the current route
   * and push the fresh structure into the CMS store, so the storefront reflects
   * the edit with no refresh — for BOTH per-component content edits AND
   * structural changes (adding / removing / reordering slot components). We
   * dispatch the component data first so every slot reference resolves, then
   * the page structure (slot membership + order) so slots re-render with the
   * new set — driven off Contentstack's global `onEntryChange` signal.
   *
   * In hybrid mode the re-run page adapter returns the merged structure (OCC
   * base + Contentstack overrides), so edits apply to the **Contentstack
   * "islands"** while OCC-sourced slots stay put. To make an OCC section
   * editable, author that slot in Contentstack — it then becomes an island.
   */
  protected refetchCurrentPage(): void {
    // Point the delivery stack at the entry being edited (draft) before the
    // adapter re-fetches — the hash is set by Visual Builder for this edit.
    this.client.applyLivePreviewHash(this.contentstackAngularService.hash);
    this.routingService
      .getPageContext()
      .pipe(take(1))
      .subscribe((pageContext: PageContext) => {
        this.pageAdapter
          .load(pageContext)
          .pipe(take(1))
          .subscribe((structure) => {
            for (const component of structure.components ?? []) {
              this.dispatchComponentUpdate(component, pageContext);
            }
            // Update the page structure so slot additions / removals /
            // reordering render live (component-data updates alone leave the
            // old slot layout in place).
            if (structure.page) {
              this.store.dispatch(
                new CmsActions.LoadCmsPageDataSuccess(pageContext, structure.page),
              );
            }
          });
      });
  }

  /** Mutates `entry` in place, populating `entry.$` with per-field `data-cslp` tags. */
  tagEntry(entry: EntryModel, contentTypeUid: string, locale: string): void {
    this.contentstackAngularService.addEditableTags(entry, contentTypeUid, locale);
  }

  hasEditableTags(element: Element): boolean {
    return element.hasAttribute('data-cslp');
  }

  /**
   * Applies a coarse, whole-entry `data-cslp` tag to the component wrapper
   * element for component-to-entry navigation (the PRD's Inspector-Mode
   * equivalent). Fine-grained per-field editing is handled separately by
   * `CsEditableDirective`, applied inside each module component's own
   * template — Contentstack's Visual Builder tags fields individually as well
   * as whole components.
   */
  addInspectorModeTags(
    element: Element,
    renderer: { setAttribute(el: Element, name: string, value: string): void },
    component: ContentSlotComponentData,
  ): void {
    // The raw tagged entry rides along in `properties.data` (set by the page
    // normalizer when live preview is on). Build the v1 entry-level CSLP tag
    // `{content_type_uid}.{entry_uid}.{locale}` directly from it — reliable and
    // independent of `addEditableTags`' internal `$` key layout (that `$` is
    // used for per-FIELD binding via `CsEditableDirective`, not here).
    const entry = component.properties?.data as
      { uid?: string; _content_type_uid?: string; locale?: string } | undefined;
    if (entry?.uid && entry._content_type_uid) {
      const locale = entry.locale ?? 'en-us';
      renderer.setAttribute(
        element,
        'data-cslp',
        `${entry._content_type_uid}.${entry.uid}.${locale}`,
      );
    }
  }

  /**
   * Push a single updated component into the CMS store for the current route.
   * Public entry point (resolves the page context itself); the internal
   * re-fetch loop uses {@link dispatchComponentUpdate} directly when it already
   * has the context.
   */
  updateCmsComponent(updatedComponent: CmsComponent): void {
    if (!updatedComponent.uid) {
      return;
    }
    this.routingService
      .getPageContext()
      .pipe(take(1))
      .subscribe((pageContext: PageContext) =>
        this.dispatchComponentUpdate(updatedComponent, pageContext),
      );
  }

  protected dispatchComponentUpdate(component: CmsComponent, pageContext: PageContext): void {
    if (!component.uid) {
      return;
    }
    this.store.dispatch(
      new CmsActions.LoadCmsComponentSuccess({
        component,
        uid: component.uid,
        pageContext,
      }),
    );
  }
}
