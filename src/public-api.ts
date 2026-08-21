/*
 * Public API surface of @contentstack/contentstack-spartacus-connector
 *
 * Import barrel for consumers of the library. A Spartacus app typically only
 * needs `ContentstackCmsModule` (the root feature module) plus the config type;
 * the remaining exports are provided for advanced customization (custom
 * adapters, normalizers, or reusing the client service in bespoke components).
 */

// Root feature module — the single entry point a Spartacus app imports.
export * from './contentstack-cms-feature.module';

// Configuration
export * from './config/contentstack-config';
export * from './config/default-contentstack-config';

// Client
export * from './client/contentstack-client.service';

// CMS override layer
export * from './cms/contentstack-cms.module';
export * from './cms/adapters/contentstack-cms-page.adapter';
export * from './cms/adapters/contentstack-cms-component.adapter';
export * from './cms/converters/contentstack-cms-page.normalizer';
export * from './cms/converters/contentstack-cms-component.normalizer';
export * from './cms/converters/contentstack-field-mapper';
export * from './cms/converters/components/contentstack-cms-banner-component.normalizer';
export * from './cms/converters/components/contentstack-cms-navigation-component.normalizer';
export * from './cms/converters/components/contentstack-cms-product-carousel-component.normalizer';
export * from './cms/model/contentstack.model';
export * from './cms/model/type-guards';
export * from './cms/model/slot-maps';

// Access control (presentation-level content gating)
export * from './cms/access/contentstack-current-user';
export * from './cms/access/contentstack-restrictions.service';

// SmartEdit bypass
export * from './guards/contentstack-smartedit-bypass';

// Live Preview / Visual Editor
export * from './live-preview/contentstack-live-preview.module';
export * from './live-preview/contentstack-angular.service';
export * from './live-preview/contentstack-live-preview.service';
export * from './live-preview/contentstack-component.decorator';
export * from './live-preview/cs-editable.directive';
export * from './live-preview/cs-empty-block-parent.directive';

// Example component (illustrative — real components live in the consuming app)
export * from './examples/hero-banner/hero.model';
export * from './examples/hero-banner/custom-hero.component';
export * from './examples/hero-banner/custom-hero.module';
