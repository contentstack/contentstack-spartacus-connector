import { Injectable } from '@angular/core';
import ContentstackLivePreview from '@contentstack/live-preview-utils';
import { addEditableTags, type EntryModel } from '@contentstack/utils';

// `IInitData`/`OnEntryChangeCallback`/`OnEntryChangeCallbackUID`/`OnEntryChangeConfig`
// are internal types used by the SDK's own signatures but not re-exported from
// its public entry point — derive them structurally from the real, installed
// `ContentstackLivePreview.init`/`.onEntryChange` signatures instead of
// guessing at (or duplicating) unexported internal type names.
type InitConfig = Parameters<typeof ContentstackLivePreview.init>[0];
type OnEntryChangeCallback = Parameters<typeof ContentstackLivePreview.onEntryChange>[0];
type OnEntryChangeConfig = Parameters<typeof ContentstackLivePreview.onEntryChange>[1];
type OnEntryChangeCallbackUID = ReturnType<typeof ContentstackLivePreview.onEntryChange>;

/**
 * Thin wrapper around Contentstack's real Live Preview / Visual Builder SDK
 * (`@contentstack/live-preview-utils`), designed directly against its own
 * documented contract. Mirrors the `kickstart-angular` precedent's init shape
 * (`ContentstackLivePreview.init({ mode: 'builder', ssr: false, stackDetails })`).
 *
 * Key divergence worth flagging: Contentstack's `onEntryChange(callback)` is a
 * single GLOBAL listener with no arguments — unlike a per-entry subscribe
 * model, the callback is responsible for re-fetching whatever it needs itself
 * (matches `kickstart-angular`'s `getEntryByUrl` re-fetch-on-change pattern).
 * There is no "subscribe to just this component" primitive here.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackAngularService {
  private initialized = false;

  init(config: {
    apiKey: string;
    environment: string;
    branch: string;
    locale: string;
    ssr?: boolean;
    mode?: 'builder' | 'preview';
    // The delivery SDK stack instance — passed so the SDK keeps the live
    // preview hash synced into `stackSdk.config.live_preview` on each edit.
    stackSdk?: unknown;
    // Host of the Contentstack app running Visual Builder (defaults handled by
    // the SDK); set for non-default regions/hosts.
    clientUrlHost?: string;
  }): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    ContentstackLivePreview.init({
      ssr: config.ssr ?? false,
      mode: config.mode ?? 'builder',
      stackDetails: {
        apiKey: config.apiKey,
        environment: config.environment,
        branch: config.branch,
        locale: config.locale,
      },
      ...(config.stackSdk ? { stackSdk: config.stackSdk } : {}),
      ...(config.clientUrlHost ? { clientUrlParams: { host: config.clientUrlHost } } : {}),
    } as InitConfig);
  }

  /**
   * Registers a single global re-fetch callback for the whole live-preview
   * session. There is no per-component subscribe/unsubscribe pair here (see
   * class doc) — callers are expected to re-fetch and re-render on trigger.
   */
  onEntryChange(callback: OnEntryChangeCallback, config?: OnEntryChangeConfig): OnEntryChangeCallbackUID {
    return ContentstackLivePreview.onEntryChange(callback, config);
  }

  /**
   * The current Live Preview hash (set by Visual Builder for the entry being
   * edited). Empty outside a preview session. Applied to the delivery stack via
   * `livePreviewQuery` before a re-fetch so draft content resolves.
   */
  get hash(): string {
    return ContentstackLivePreview.hash;
  }

  /**
   * Mutates `entry` in place, attaching a `$` property mapping each field uid
   * to its `data-cslp` tag object (`entry.$.title['data-cslp']`, etc.) —
   * wraps `@contentstack/utils`'s `addEditableTags` (a separate real package
   * from `@contentstack/live-preview-utils`).
   */
  addEditableTags(entry: EntryModel, contentTypeUid: string, locale: string): void {
    addEditableTags(entry, contentTypeUid, true, locale);
  }
}
