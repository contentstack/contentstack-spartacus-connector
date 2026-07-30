/**
 * Verifies the `ng add` schematic performs the real wiring via the actual
 * `SchematicTestRunner` — generating the app-side `ContentstackFeatureModule`
 * (with `provideConfig(<ContentstackConfig>{…})` from the options) and adding it
 * to `SpartacusFeaturesModule`. Uses a test-only `@spartacus/schematics` stub
 * (see `test/stubs/spartacus-schematics.stub.ts`, compiled by
 * `npm run pretest:schematics`); the feature wiring itself is exercised for real
 * (it uses `@schematics/angular` utilities, not Spartacus's feature registry).
 */
import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';

describe('ng-add schematic', () => {
  const collectionPath = require.resolve('../collection.json');
  const runner = new SchematicTestRunner('contentstack-spartacus-connector', collectionPath);

  const FEATURES_MODULE = 'src/app/spartacus/spartacus-features.module.ts';
  const FEATURE_MODULE = 'src/app/spartacus/features/contentstack/contentstack-feature.module.ts';

  function baseAppTree(): Tree {
    const tree = Tree.empty();
    tree.create(
      'angular.json',
      JSON.stringify({ version: 1, projects: { app: { root: '', sourceRoot: 'src' } } }),
    );
    tree.create(
      'package.json',
      JSON.stringify({ name: 'test-app', dependencies: { '@spartacus/core': '~2211.0.0' } }),
    );
    tree.create(
      FEATURES_MODULE,
      `import { NgModule } from '@angular/core';\n\n@NgModule({\n  imports: [],\n})\nexport class SpartacusFeaturesModule {}\n`,
    );
    return tree;
  }

  it('generates the feature module with config from the options and wires it in', async () => {
    const tree = await runner.runSchematic(
      'ng-add',
      {
        project: 'app',
        apiKey: 'blt123',
        deliveryToken: 'cs_delivery',
        environment: 'development',
        region: 'EU',
        cmsPageContentType: 'landing_page',
        occFallback: true,
        includeFallback: true,
      },
      baseAppTree(),
    );

    expect(tree.exists(FEATURE_MODULE)).toBe(true);
    const generated = tree.readText(FEATURE_MODULE);
    expect(generated).toContain(
      "import {\n  ContentstackCmsFeatureModule,\n  ContentstackConfig,\n} from '@contentstack/contentstack-spartacus-connector'",
    );
    expect(generated).toContain('imports: [ContentstackCmsFeatureModule]');
    expect(generated).toContain('provideConfig(<ContentstackConfig>{');
    expect(generated).toContain("apiKey: 'blt123'");
    expect(generated).toContain("deliveryToken: 'cs_delivery'");
    expect(generated).toContain('region: Region.EU'); // 'EU' -> Region.EU
    expect(generated).toContain('occFallback: true');
    expect(generated).toContain('includeFallback: true');
    // livePreview / localeMapping / accessControl are always scaffolded (even at
    // defaults) so they're discoverable — livePreview off unless requested.
    expect(generated).toContain('livePreview: false');
    expect(generated).toContain("localeMapping: { en: 'en-us', de: 'de-de' }");
    expect(generated).toContain('accessControl: { enabled: false }');

    // Wired into SpartacusFeaturesModule.
    const features = tree.readText(FEATURES_MODULE);
    expect(features).toContain(
      "import { ContentstackFeatureModule } from './features/contentstack/contentstack-feature.module'",
    );
    expect(features).toContain('ContentstackFeatureModule');

    // Peer deps added to the app package.json.
    const pkg = JSON.parse(tree.readText('package.json'));
    expect(pkg.dependencies['@spartacus/core']).toBeTruthy();
  });

  it('scaffolds placeholders when config options are omitted, and Live Preview when enabled', async () => {
    const tree = await runner.runSchematic(
      'ng-add',
      { project: 'app', livePreview: true },
      baseAppTree(),
    );

    const generated = tree.readText(FEATURE_MODULE);
    expect(generated).toContain("apiKey: '<STACK_API_KEY>'");
    expect(generated).toContain("deliveryToken: '<DELIVERY_TOKEN>'");
    expect(generated).toContain("environment: '<ENVIRONMENT>'");
    expect(generated).toContain('region: Region.US'); // default
    expect(generated).toContain('livePreview: true');
    expect(generated).toContain("previewToken: '<PREVIEW_TOKEN>'");
    expect(generated).toContain('occFallback: true'); // default
    // Discoverability blocks present regardless of Live Preview.
    expect(generated).toContain("localeMapping: { en: 'en-us', de: 'de-de' }");
    expect(generated).toContain('accessControl: { enabled: false }');
  });

  it('maps a hyphenated region key to the Region enum member', async () => {
    const tree = await runner.runSchematic(
      'ng-add',
      { project: 'app', region: 'AZURE-NA' },
      baseAppTree(),
    );
    expect(tree.readText(FEATURE_MODULE)).toContain('region: Region.AZURE_NA');
  });

  it('fails fast when @spartacus/core is not installed', async () => {
    const tree = Tree.empty();
    tree.create(
      'angular.json',
      JSON.stringify({ version: 1, projects: { app: { root: '', sourceRoot: 'src' } } }),
    );
    tree.create('package.json', JSON.stringify({ name: 'test-app', dependencies: {} }));
    await expect(runner.runSchematic('ng-add', { project: 'app' }, tree)).rejects.toThrow();
  });

  it('is registered under both the ng-add and add schematic names', async () => {
    const t1 = await runner.runSchematic('ng-add', { project: 'app' }, baseAppTree());
    const t2 = await runner.runSchematic('add', { project: 'app' }, baseAppTree());
    expect(t1.exists(FEATURE_MODULE)).toBe(true);
    expect(t2.exists(FEATURE_MODULE)).toBe(true);
  });
});
