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
import * as ts from 'typescript';
import { buildContentstackEnvironment, buildFeatureModule } from './configure';

describe('ng-add schematic', () => {
  const collectionPath = require.resolve('../collection.json');
  const runner = new SchematicTestRunner('contentstack-spartacus-connector', collectionPath);

  const FEATURES_MODULE = 'src/app/spartacus/spartacus-features.module.ts';
  const FEATURE_MODULE = 'src/app/spartacus/features/contentstack/contentstack-feature.module.ts';
  // Delivery credentials are emitted here, not inlined in the feature module.
  const ENV_FILE = 'src/environments/contentstack.environment.ts';

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
        apiKey: 'blt0123456789abcdef',
        deliveryToken: 'cs0123456789abcdef',
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
    // Credentials are referenced from the env file, NOT inlined here.
    expect(generated).toContain(
      "import { contentstackDelivery } from '../../../../environments/contentstack.environment'",
    );
    expect(generated).toContain('delivery: contentstackDelivery');
    expect(generated).not.toContain('apiKey:');
    expect(generated).not.toContain('deliveryToken:');
    expect(generated).toContain('occFallback: true');
    expect(generated).toContain('includeFallback: true');
    expect(generated).toContain("localeMapping: { en: 'en-us', de: 'de-de' }");
    expect(generated).toContain('accessControl: { enabled: false }');

    // Delivery credentials land in the dedicated env file, JSON.stringify'd.
    expect(tree.exists(ENV_FILE)).toBe(true);
    const env = tree.readText(ENV_FILE);
    expect(env).toContain('export const contentstackDelivery = {');
    expect(env).toContain('apiKey: "blt0123456789abcdef"');
    expect(env).toContain('deliveryToken: "cs0123456789abcdef"');
    expect(env).toContain('region: Region.EU'); // 'EU' -> Region.EU
    expect(env).toContain('livePreview: false');
    // previewToken is omitted entirely unless Live Preview is requested.
    expect(env).not.toContain('previewToken');

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

    // Placeholders + Live Preview live in the env file.
    const env = tree.readText(ENV_FILE);
    expect(env).toContain('apiKey: "<STACK_API_KEY>"');
    expect(env).toContain('deliveryToken: "<DELIVERY_TOKEN>"');
    expect(env).toContain('environment: "<ENVIRONMENT>"');
    expect(env).toContain('region: Region.US'); // default
    expect(env).toContain('livePreview: true');
    // previewToken IS emitted (as a placeholder) only because Live Preview is on.
    expect(env).toContain('previewToken: "<PREVIEW_TOKEN>"');

    // Non-secret config + discoverability blocks stay in the module.
    const generated = tree.readText(FEATURE_MODULE);
    expect(generated).toContain('occFallback: true'); // default
    expect(generated).toContain("localeMapping: { en: 'en-us', de: 'de-de' }");
    expect(generated).toContain('accessControl: { enabled: false }');
  });

  it('accepts blank (empty-string) answers and scaffolds placeholders', async () => {
    // The interactive prompts let the user hit enter to accept a blank value;
    // the strict patterns must still allow "" so blank falls back to a placeholder
    // rather than failing validation and re-prompting forever.
    const tree = await runner.runSchematic(
      'ng-add',
      { project: 'app', apiKey: '', deliveryToken: '', environment: '', previewToken: '' },
      baseAppTree(),
    );
    const env = tree.readText(ENV_FILE);
    expect(env).toContain('apiKey: "<STACK_API_KEY>"');
    expect(env).toContain('deliveryToken: "<DELIVERY_TOKEN>"');
    expect(env).toContain('environment: "<ENVIRONMENT>"');
  });

  it('maps a hyphenated region key to the Region enum member', async () => {
    const tree = await runner.runSchematic(
      'ng-add',
      { project: 'app', region: 'AZURE-NA' },
      baseAppTree(),
    );
    expect(tree.readText(ENV_FILE)).toContain('region: Region.AZURE_NA');
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

  // --- code injection via ng add option values ---

  it('rejects an option value that breaks the schema pattern (schema-layer guard)', async () => {
    // A break-out payload does not match the strict apiKey pattern, so the
    // schematic fails fast at option validation before generating anything.
    await expect(
      runner.runSchematic(
        'ng-add',
        { project: 'app', apiKey: "blt0123456789abcdef', evil: (() => {})(), x: '" },
        baseAppTree(),
      ),
    ).rejects.toThrow();
  });

  it('escapes hostile option values so neither generated file can break out (escaping-layer guard)', () => {
    // The builders are the last line of defense: even if a hostile value reaches
    // them (schema bypassed, programmatic call), each must emit a safely escaped
    // literal that parses as a single string — no injected statements.
    const payload = `x', evilProp: (() => { throw new Error('pwned'); })(), y: "a\\b\nc`;
    const opts = {
      project: 'app',
      apiKey: payload,
      deliveryToken: payload,
      environment: payload,
      cmsPageContentType: payload,
      previewToken: payload,
      livePreview: true,
    };
    const parsesClean = (fileName: string, source: string) => {
      const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
      return (sf as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics;
    };

    // Env file: the credential fields are the injectable ones.
    const env = buildContentstackEnvironment(opts);
    expect(env).toContain(`apiKey: ${JSON.stringify(payload)}`);
    expect(env).toContain(`previewToken: ${JSON.stringify(payload)}`);
    expect(parsesClean('contentstack.environment.ts', env)).toHaveLength(0);

    // Feature module: cmsPageContentType is the injectable field.
    const mod = buildFeatureModule(opts);
    expect(mod).toContain(`cmsPageContentType: ${JSON.stringify(payload)}`);
    expect(parsesClean('contentstack-feature.module.ts', mod)).toHaveLength(0);
  });
});
