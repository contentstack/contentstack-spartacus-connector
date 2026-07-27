import { NgModule } from '@angular/core';
import { Config, provideDefaultConfig } from '@spartacus/core';
import { ContentstackCmsModule } from './cms/contentstack-cms.module';
import { ContentstackLivePreviewModule } from './live-preview/contentstack-live-preview.module';
import { ContentstackConfig } from './config/contentstack-config';
import { defaultContentstackConfig } from './config/default-contentstack-config';

/**
 * Root feature module — the single entry point a Spartacus app imports to
 * activate the Contentstack CMS integration.
 *
 * What importing this module does:
 *  1. Imports {@link ContentstackCmsModule} **eagerly** — registers the CMS
 *     adapter override (`CmsPageAdapter`/`CmsComponentAdapter` → Contentstack).
 *     Must be eager: the adapter resolves the very first page request at
 *     bootstrap, so it cannot be deferred behind a lazy `featureModules` gate.
 *  2. Imports {@link ContentstackLivePreviewModule} **eagerly** — registers the
 *     `ComponentDecorator` override that drives Live Preview / Visual Editor
 *    . Also eager, and for the same structural reason: Spartacus's
 *     decorator extension point is consulted as components render, and the
 *     Contentstack Live Preview SDK only initializes (via the decorator →
 *     `ContentstackLivePreviewService`) when `delivery.livePreview` is set — so
 *     it stays inert on normal delivery builds and activates on preview builds.
 *  3. Registers {@link defaultContentstackConfig} as default config, so the app
 *     only needs to supply credentials via its own `provideConfig(...)`.
 *
 * (Both submodules were previously behind a lazy `CmsConfig.featureModules`
 * entry — the standard Spartacus code-splitting convention — but that gate only
 * fires when a `cmsComponents` component tagged with the feature renders, which
 * this connector never registers. So the entry never loaded and neither the CMS
 * override nor Live Preview activated; both are now imported eagerly.)
 *
 * What it deliberately does NOT do:
 *  - It does not import Spartacus's `SmartEditRootModule`. That omission is the
 *    primary SmartEdit bypass (no handshake APP_INITIALIZER, no CmsTicket
 *    interceptor) — see `guards/contentstack-smartedit-bypass.ts`.
 *  - It does not register any `cmsComponents` mappings. Mapping Contentstack
 *    block/content types to Angular components is app-specific; follow the
 *    pattern in the `examples/hero-banner` module.
 *
 * IMPORTANT — import ordering: import `ContentstackCmsFeatureModule` *after* the
 * base Spartacus modules (which include `CmsOccModule`) so our adapter providers
 * win. In a standard `ng add @spartacus/schematics` app, importing it in
 * `SpartacusFeaturesModule` (or after `StorefrontModule`) satisfies this.
 */
@NgModule({
  imports: [ContentstackCmsModule, ContentstackLivePreviewModule],
  providers: [
    provideDefaultConfig(defaultContentstackConfig),
    // Bind the typed config accessor to Spartacus's merged global Config, so
    // injecting `ContentstackConfig` yields the config assembled by
    // provideConfig/provideDefaultConfig (mirrors `{ provide: CmsConfig, useExisting: Config }`).
    { provide: ContentstackConfig, useExisting: Config },
  ],
})
export class ContentstackCmsFeatureModule {}
