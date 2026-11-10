import { Injectable, inject } from '@angular/core';
import {
  CmsActions,
  CmsComponent,
  CmsService,
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
import { retargetTagLocale } from './tag-entry-tree';
import { regionHost } from './live-preview-gate';
import { toSiteLanguage, vbLocaleFromMessage, vbLocaleFromUrl } from './vb-locale';
import { tagNavigationDom } from './tag-navigation-dom';
import {
  CmsNavigationNodeWithTags,
  ContentstackCmsNavigationComponentNormalizer,
} from '../cms/converters/components/contentstack-cms-navigation-component.normalizer';

/** Navigation typecodes whose menu items get per-item edit tags (DX-27704). */
const NAVIGATION_TYPE_CODES = new Set([
  'CategoryNavigationComponent',
  'FooterNavigationComponent',
  'NavigationComponent',
]);

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
  /** Guards the one-time Visual Builder SDK init (see the constructor). */
  private initialized = false;
  /**
   * The Contentstack locale (e.g. `en-us`) for the active site language, kept in
   * sync with `LanguageService`. Used when (re)applying edit tags so they target
   * the entry in the language the shopper is viewing, not the init-time locale.
   */
  protected currentCsLocale: string | undefined;
  protected navigationNormalizer = inject(ContentstackCmsNavigationComponentNormalizer);
  protected cmsService = inject(CmsService);

  constructor(
    protected contentstackAngularService: ContentstackAngularService,
    protected config: ContentstackConfig,
    protected store: Store<StateWithCms>,
    protected routingService: RoutingService,
    protected languageService: LanguageService,
    protected pageAdapter: ContentstackCmsPageAdapter,
    protected client: ContentstackClientService,
  ) {
    // Only initialize the Live Preview SDK when Live Preview is active (the
    // shared rule in `isLivePreviewActive`, which the delivery client also uses).
    // Otherwise this service stays inert, so the eagerly-loaded module adds no
    // preview behavior to normal delivery builds.
    if (!this.client.livePreviewActive) {
      return;
    }
    // Contentstack's Live Preview SDK injects one global inspector tooltip
    // (`#cslp-tooltip`) and does NOT reset it on Angular's client-side route
    // changes. After visiting a page with editable content, that tooltip can
    // linger on the next page — still pointing at the now-unmounted entry — even
    // on an OCC-only page with no Contentstack islands (e.g. a category/PLP
    // page), showing a stray "Edit" button that opens the wrong entry. Hide it
    // on every navigation so it only reappears when the shopper actually hovers
    // a tagged element on the current page.
    this.routingService.getPageContext().subscribe(() => this.resetInspectorTooltip());
    // Track the active language for the whole session. The Visual Builder SDK
    // is initialized ONCE (it does not re-init cleanly, so the VB *session* is
    // single-locale), but the storefront's on-page edit tags must still follow
    // the shopper's language — so on every subsequent language change we rewrite
    // the tags in place (see `retagEditTagsForLocale`) rather than freezing them
    // at the init-time locale.
    // Visual Builder's locale drives the storefront language (DX-27690): the
    // `locale` param it loads the iframe with, then every `get-locale` message
    // it sends when the editor switches locale.
    this.listenForVisualBuilderLocale();
    this.languageService.getActive().subscribe((language) => {
      const csLocale = this.resolveLocale(language);
      this.currentCsLocale = csLocale;
      if (!this.initialized) {
        this.initialized = true;
        // Start the SDK right away: Visual Builder waits for its handshake, so it
        // must never depend on anything else completing first. If Visual Builder
        // opened the page in another locale (`?locale=de-de`), the SDK starts in
        // that locale and the storefront follows (the switch re-fetches content
        // and retargets the edit tags through the normal language flow).
        const bootCsLocale = this.bootVisualBuilderLocale();
        const bootLanguage = this.siteLanguageFor(bootCsLocale);
        const initLocale = bootLanguage ? this.resolveLocale(bootLanguage) : csLocale;
        const delivery = this.config.contentstack?.delivery;
        this.contentstackAngularService.init({
          apiKey: delivery?.apiKey ?? '',
          environment: delivery?.environment ?? '',
          branch: delivery?.branch ?? 'main',
          // The Contentstack locale (`en-us`), mapped from the Spartacus isocode
          // or taken from Visual Builder — NOT the raw `en`/`de` isocode.
          locale: initLocale,
          ssr: false,
          mode: 'builder',
          // Hand the SDK the delivery stack's config so it keeps the Live
          // Preview hash (and Timeline context) in sync on the stack itself, as
          // the kickstarts do.
          stackSdk: (this.client.sdkStack as unknown as { config: unknown }).config,
          clientUrlHost: delivery?.applicationHost ?? regionHost(delivery?.region, 'application'),
          editButton: { enable: true, exclude: ['outsideLivePreviewPortal'] },
        });
        // On any edit in the Visual Builder, re-fetch + re-dispatch (or defer to
        // an app-provided override). Contentstack's `onEntryChange` is a single
        // global, argument-less callback (see ContentstackAngularService) — it
        // does not say WHAT changed, so we reload the whole current page.
        this.contentstackAngularService.onEntryChange(() =>
          this.customRefetch ? this.customRefetch() : this.refetchCurrentPage(),
        );
        // Only now switch the storefront to Visual Builder's locale; the SDK is
        // already up, so a slow or ignored switch can't block the handshake.
        if (bootLanguage && bootLanguage !== language) {
          this.languageService.setActive(bootLanguage);
        }
      } else {
        // Language switched mid-session: retarget every already-rendered edit
        // tag at the new locale. Component wrappers are decorated once at
        // creation and Spartacus reuses them across a language switch, so the
        // wrapper tags would otherwise stay stuck on the init-time locale.
        this.retagEditTagsForLocale(csLocale);
      }
    });
  }

  /** The `locale` param Visual Builder loaded the storefront with (browser only). */
  protected bootVisualBuilderLocale(): string | undefined {
    return typeof window !== 'undefined' ? vbLocaleFromUrl(window.location.search) : undefined;
  }

  /** Follow Visual Builder's `get-locale` messages for the rest of the session. */
  protected listenForVisualBuilderLocale(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('message', (event: MessageEvent) => {
      const csLocale = vbLocaleFromMessage(event.data);
      if (csLocale) {
        this.languageService
          .getActive()
          .pipe(take(1))
          .subscribe((active) => this.followVisualBuilderLocale(csLocale, active));
      }
    });
  }

  /**
   * Switch the storefront to the site language that matches Visual Builder's
   * Contentstack locale. Returns true when a switch was requested. The rest
   * follows from the normal language flow: content re-fetches in the new
   * locale and edit tags are retargeted.
   */
  protected followVisualBuilderLocale(csLocale: string | undefined, active: string): boolean {
    const iso = this.siteLanguageFor(csLocale);
    if (!iso || iso === active) {
      return false;
    }
    this.languageService.setActive(iso);
    return true;
  }

  /**
   * The site language for a Visual Builder (Contentstack) locale. Only languages
   * the app maps explicitly in `localeMapping` count: they are the site's
   * languages, and Spartacus ignores an unknown isocode.
   */
  protected siteLanguageFor(csLocale: string | undefined): string | undefined {
    const mapping = this.config.contentstack?.localeMapping;
    if (!csLocale || !mapping) {
      return undefined;
    }
    return toSiteLanguage(csLocale, mapping, Object.keys(mapping));
  }

  /**
   * Map a Spartacus site-language isocode (e.g. `de`) to the Contentstack locale
   * content is authored in (e.g. `de-de`) via `localeMapping` — identity
   * fallback for unmapped codes, `en-us` when no language is resolved yet.
   * Mirrors the delivery client's `resolveLocale` so tags and fetched content
   * agree on the locale.
   */
  protected resolveLocale(locale?: string): string {
    if (!locale) {
      return 'en-us';
    }
    return this.config.contentstack?.localeMapping?.[locale] ?? locale;
  }

  /**
   * Rewrite the locale segment of every `data-cslp` edit tag currently in the
   * DOM to `csLocale`. A Contentstack CSLP v1 tag is
   * `${contentTypeUid}.${entryUid}.${locale}[.${field}…]`, and an entry's uid is
   * the SAME across locales, so retargeting an edit tag at another language is
   * purely a locale-segment swap — no re-fetch or re-render needed. Runs on a
   * language switch to keep Visual Builder's edit buttons pointing at the entry
   * in the language the shopper is viewing (browser-only; no-op under SSR).
   */
  protected retagEditTagsForLocale(csLocale: string): void {
    if (typeof document === 'undefined' || !csLocale) {
      return;
    }
    document.querySelectorAll('[data-cslp]').forEach((el) => {
      const current = el.getAttribute('data-cslp');
      if (!current) {
        return;
      }
      const next = retargetTagLocale(current, csLocale);
      if (next !== current) {
        el.setAttribute('data-cslp', next);
      }
    });
  }

  /**
   * Hide Contentstack's global Live Preview inspector tooltip (`#cslp-tooltip`)
   * by parking it offscreen. The SDK repositions it via inline `top`/`left` when
   * the shopper hovers a genuinely tagged element on the current page, so this
   * only clears a stale target carried over from a previous route — it does not
   * disable editing. Browser-only; no-op under SSR.
   */
  protected resetInspectorTooltip(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const tooltip = document.getElementById('cslp-tooltip');
    if (tooltip) {
      tooltip.style.top = '-9999px';
      tooltip.style.left = '-9999px';
    }
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
    // page re-loads; the hash is set by Visual Builder for this edit.
    this.client.applyLivePreviewContext(this.contentstackAngularService.hash);
    // Re-load the current page through Spartacus's own CMS pipeline (page
    // connector -> our adapter -> normalizers), not by dispatching the adapter's
    // structure directly. The pipeline also merges Spartacus's static CMS
    // structure (e.g. PreHeader's hamburger menu and SiteLogin's sign-in link);
    // bypassing it dropped those slots for the whole Visual Builder session.
    // It dispatches both the page structure (slot additions, removals and
    // reordering) and every component's data, so edits render live.
    this.cmsService.refreshLatestPage();
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
    // The page normalizer puts the component's slot-position tag in
    // `properties.cslp`: `{page_ct}.{page_uid}.{locale}.{slot_field}.{index}`.
    // On the component element it makes Visual Builder treat the component as
    // item N of the slot's reference field: select it, open its entry, move,
    // duplicate or delete it. Components without one (OCC-rendered, or loaded
    // outside a page slot) get no tag: a bare `ct.uid.locale` entry tag is
    // rejected by Visual Builder as an invalid CSLP tag.
    const tag = component.properties?.cslp as string | undefined;
    if (tag) {
      renderer.setAttribute(element, 'data-cslp', this.forCurrentLocale(tag));
    }
    if (component.typeCode && NAVIGATION_TYPE_CODES.has(component.typeCode)) {
      this.tagNavigationItems(element, component);
    }
  }

  /**
   * Tag each menu item of a navigation component with its `nav_node_flat` title
   * (or link name) edit tag, so Visual Builder can select it (DX-27704). The
   * stock navigation renders asynchronously and re-renders on language switches
   * and edits, so the tags are (re)applied whenever its DOM changes.
   */
  protected tagNavigationItems(element: Element, component: ContentSlotComponentData): void {
    const raw = component.properties?.data as Record<string, unknown> | undefined;
    if (!raw || typeof MutationObserver === 'undefined' || !this.navigationNormalizer) {
      return;
    }
    let tree = this.navigationNormalizer.convert(raw as never).navigationNode as
      CmsNavigationNodeWithTags | undefined;
    let scheduled = false;
    const apply = () => {
      scheduled = false;
      tagNavigationDom(element, tree, (t) => this.forCurrentLocale(t));
    };
    apply();
    // Spartacus keeps this component across a language switch and reloads its
    // data in the new locale. Follow that data, or the labels would be matched
    // against the init-time locale's texts and most items would lose their tag.
    if (component.uid) {
      this.cmsService
        .getComponentData<CmsComponent & { navigationNode?: CmsNavigationNodeWithTags }>(
          component.uid,
        )
        .subscribe((data) => {
          if (data?.navigationNode) {
            tree = data.navigationNode;
            apply();
          }
        });
    }
    new MutationObserver(() => {
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(apply);
      }
    }).observe(element, { childList: true, subtree: true, characterData: true });
  }

  /**
   * Point an edit tag at the active site locale (a wrapper decorated after a
   * language switch should already match it); later switches are handled by
   * {@link retagEditTagsForLocale}.
   */
  forCurrentLocale(tag: string): string {
    return this.currentCsLocale ? retargetTagLocale(tag, this.currentCsLocale) : tag;
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
