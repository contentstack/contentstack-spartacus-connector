import { isDevMode } from '@angular/core';
import { getContentstackEndpoint } from '@contentstack/utils';
import type { ContentstackConfig } from '../config/contentstack-config';

type DeliveryConfig = NonNullable<ContentstackConfig['contentstack']>['delivery'];

/** URL params Visual Builder / Live Preview add when they load the storefront. */
const PREVIEW_PARAMS = ['live_preview', 'builder', 'preview_timestamp', 'release_id'];

/** Minimal view of the browser globals the gate reads (injectable for tests). */
export interface LivePreviewWindow {
  self: unknown;
  top: unknown;
  location: { search: string };
}

/**
 * The one rule for whether Live Preview / Visual Builder is active. Every
 * consumer (delivery client, Live Preview SDK init, edit tagging) uses it, so
 * they can't disagree.
 *
 * Active only when ALL hold:
 *  1. `delivery.livePreview` is on and a `previewToken` is configured;
 *  2. the build is in dev mode, or `delivery.livePreviewAllowInProduction` is on
 *     (a dedicated preview deployment, never the shopper site);
 *  3. in the browser, the page is inside an iframe (Visual Builder / Live Preview
 *     panel) or carries a Live Preview URL param. On the server there is no
 *     window, so conditions 1–2 decide.
 *
 * Outside those conditions the connector behaves exactly like a delivery build:
 * no preview host, no SDK, no `data-cslp` attributes.
 */
export function isLivePreviewActive(
  delivery: DeliveryConfig | undefined,
  win: LivePreviewWindow | undefined = typeof window !== 'undefined' ? window : undefined,
  devMode: boolean = isDevMode(),
): boolean {
  if (!delivery?.livePreview || !delivery.previewToken) {
    return false;
  }
  if (!devMode && !delivery.livePreviewAllowInProduction) {
    return false;
  }
  if (!win) {
    return true;
  }
  return isInPreviewContext(win);
}

/** True inside an iframe, or when the URL carries a Live Preview param. */
export function isInPreviewContext(win: LivePreviewWindow): boolean {
  let framed = false;
  try {
    framed = win.self !== win.top;
  } catch {
    // Cross-origin parent: reading `top` can throw, which itself means framed.
    framed = true;
  }
  if (framed) {
    return true;
  }
  const params = new URLSearchParams(win.location.search);
  return PREVIEW_PARAMS.some((p) => params.has(p));
}

/** Region value → `@contentstack/utils` endpoint key (delivery-sdk uses `us`, `eu`, `azure-na`, …). */
function regionKey(region: string | undefined): string {
  return (region ?? 'us').toString().toLowerCase();
}

/**
 * Host of a Contentstack service for the configured region, without `https://`.
 * Falls back to the North America host when the region is unknown.
 */
export function regionHost(region: string | undefined, service: 'preview' | 'application'): string {
  const fallback = service === 'preview' ? 'rest-preview.contentstack.com' : 'app.contentstack.com';
  try {
    const host = getContentstackEndpoint(regionKey(region), service, true);
    return typeof host === 'string' && host ? host : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Live Preview / Timeline context Visual Builder puts in the storefront URL when
 * it loads it. Only keys that are present are returned, because the Delivery SDK's
 * `livePreviewQuery` treats a missing `release_id` / `preview_timestamp` as
 * "clear the Timeline headers".
 */
export interface LivePreviewContext {
  live_preview?: string;
  content_type_uid?: string;
  entry_uid?: string;
  preview_timestamp?: string;
  release_id?: string;
}

const CONTEXT_KEYS: (keyof LivePreviewContext)[] = [
  'live_preview',
  'content_type_uid',
  'entry_uid',
  'preview_timestamp',
  'release_id',
];

/** Read the Live Preview / Timeline context from a URL query string. */
export function readLivePreviewContext(search: string): LivePreviewContext {
  const params = new URLSearchParams(search);
  const ctx: LivePreviewContext = {};
  for (const key of CONTEXT_KEYS) {
    const value = params.get(key);
    if (value) {
      ctx[key] = value;
    }
  }
  return ctx;
}
