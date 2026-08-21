/**
 * Self-contained feature wiring (no dependency on Spartacus's feature registry).
 * Generates an app-side `ContentstackFeatureModule` that imports the connector's
 * `ContentstackCmsFeatureModule` and provides the `ContentstackConfig` from the
 * `ng add` answers, then adds it to the app's `SpartacusFeaturesModule`.
 */
import { Rule, SchematicContext, SchematicsException, Tree } from '@angular-devkit/schematics';
import { addSymbolToNgModuleMetadata } from '@schematics/angular/utility/ast-utils';
import { InsertChange } from '@schematics/angular/utility/change';
import * as ts from 'typescript';
import { SpartacusContentstackOptions } from './index';

const PACKAGE = '@contentstack/contentstack-spartacus-connector';
const FEATURE_MODULE_CLASS = 'ContentstackFeatureModule';
/**
 * Delivery credentials are emitted into a dedicated environment file rather than
 * inlined in the committed feature module, so secrets (esp. the Live Preview
 * token) are not hard-coded into an NgModule and can be swapped per environment.
 */
const ENV_FILE_RELATIVE = 'environments/contentstack.environment.ts';
/** Import path from the generated feature module to the env file (fixed layout). */
const ENV_IMPORT_PATH = '../../../../environments/contentstack.environment';
/** Region key (schema) → `Region` enum member from `@contentstack/delivery-sdk`. */
const REGION_MAP: Record<string, string> = {
  US: 'US',
  EU: 'EU',
  'AZURE-NA': 'AZURE_NA',
  'AZURE-EU': 'AZURE_EU',
  'GCP-NA': 'GCP_NA',
  'GCP-EU': 'GCP_EU',
};

export function configureContentstackFeature(options: SpartacusContentstackOptions): Rule {
  return (tree: Tree, context: SchematicContext): Tree => {
    const sourceRoot = getSourceRoot(tree, options.project);
    const featureDir = `${sourceRoot}/app/spartacus/features/contentstack`;
    const featureModulePath = `${featureDir}/contentstack-feature.module.ts`;

    // 1) Generate (or refresh) the app-side feature module from the answers.
    const content = buildFeatureModule(options);
    if (tree.exists(featureModulePath)) {
      tree.overwrite(featureModulePath, content);
    } else {
      tree.create(featureModulePath, content);
    }

    // 1a) Emit delivery credentials into a dedicated environment file (kept out
    // of the committed feature module).
    const envPath = `${sourceRoot}/${ENV_FILE_RELATIVE}`;
    const envContent = buildContentstackEnvironment(options);
    if (tree.exists(envPath)) {
      tree.overwrite(envPath, envContent);
    } else {
      tree.create(envPath, envContent);
    }

    // 2) Wire it into the app's SpartacusFeaturesModule.
    const featuresModulePath = `${sourceRoot}/app/spartacus/spartacus-features.module.ts`;
    if (!tree.exists(featuresModulePath)) {
      context.logger.warn(
        `[Contentstack] Could not find ${featuresModulePath}. ` +
          `Generated ${featureModulePath}; import ${FEATURE_MODULE_CLASS} into your Spartacus features module manually.`,
      );
      return tree;
    }

    const source = ts.createSourceFile(
      featuresModulePath,
      tree.read(featuresModulePath)!.toString('utf-8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const changes = addSymbolToNgModuleMetadata(
      source,
      featuresModulePath,
      'imports',
      FEATURE_MODULE_CLASS,
      './features/contentstack/contentstack-feature.module',
    );
    const recorder = tree.beginUpdate(featuresModulePath);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    tree.commitUpdate(recorder);

    context.logger.info(
      '[Contentstack] Feature wired. Next: import the Content Model Starter Pack with the Contentstack CLI —\n' +
        '  csdx auth:login\n' +
        `  csdx cm:stacks:import --stack-api-key <API_KEY> --data-dir ./node_modules/${PACKAGE}/import-export/starter-pack --yes\n` +
        `  then publish the entries and fill any <PLACEHOLDER> credentials in ${ENV_FILE_RELATIVE}. See the library GETTING_STARTED.md.`,
    );
    return tree;
  };
}

function getSourceRoot(tree: Tree, project?: string): string {
  const raw = tree.read('angular.json');
  if (!raw) {
    throw new SchematicsException(
      'angular.json not found — run this at the root of an Angular workspace.',
    );
  }
  const workspace = JSON.parse(raw.toString('utf-8'));
  const projects: Record<string, { root?: string; sourceRoot?: string }> = workspace.projects ?? {};
  const name = project && projects[project] ? project : Object.keys(projects)[0];
  const proj = name ? projects[name] : undefined;
  if (!proj) {
    throw new SchematicsException('No Angular project found in angular.json.');
  }
  return proj.sourceRoot ?? (proj.root ? `${proj.root}/src` : 'src');
}

/**
 * Value-or-placeholder, then ALWAYS JSON-serialized so the result is a safely
 * escaped literal. Never interpolate a raw option value into a quoted string — an
 * apostrophe (or newline/backslash) would otherwise break out of the literal and
 * inject code into the customer's committed source.
 */
const lit = (v: string | undefined, placeholder: string) =>
  JSON.stringify(v && v.length ? v : placeholder);

/**
 * The dedicated environment file holding delivery credentials. Kept separate from
 * the feature module so secrets aren't committed inside an NgModule and can be
 * swapped per environment / CI build. `previewToken` is emitted
 * ONLY when Live Preview is requested — it grants read access to unpublished
 * draft content and must never ship in a normal delivery build.
 */
export function buildContentstackEnvironment(options: SpartacusContentstackOptions): string {
  const region = REGION_MAP[options.region ?? 'US'] ?? 'US';
  const livePreview = !!options.livePreview;
  const previewTokenBlock = livePreview
    ? `
  // SECURITY: the preview token grants read access to UNPUBLISHED draft content.
  // Treat it as a secret — use it only in a non-production build and do NOT commit
  // a real value (keep this file out of version control if it holds one).
  previewToken: ${lit(options.previewToken, '<PREVIEW_TOKEN>')},`
    : '';

  return `import { Region } from '@contentstack/delivery-sdk';

/**
 * Contentstack delivery credentials for the Spartacus connector. Generated by
 * \`ng add\`; referenced from ContentstackFeatureModule via \`contentstackDelivery\`.
 *
 * apiKey and deliveryToken are read-only, environment-scoped delivery credentials
 * (safe to ship in the client bundle). Fill any <PLACEHOLDER> values. To override
 * per environment, mirror this file under Angular's \`fileReplacements\`.
 */
export const contentstackDelivery = {
  apiKey: ${lit(options.apiKey, '<STACK_API_KEY>')},
  deliveryToken: ${lit(options.deliveryToken, '<DELIVERY_TOKEN>')},
  environment: ${lit(options.environment, '<ENVIRONMENT>')},
  region: Region.${region},
  // Live Preview / Visual Builder. Enable ONLY in a non-production build; the
  // connector refuses to activate Live Preview when the app runs in production.
  livePreview: ${livePreview},${previewTokenBlock}
};
`;
}

export function buildFeatureModule(options: SpartacusContentstackOptions): string {
  const occFallback = options.occFallback !== false; // default true
  const includeFallback = !!options.includeFallback;

  return `import { NgModule } from '@angular/core';
import { provideConfig } from '@spartacus/core';
import {
  ContentstackCmsFeatureModule,
  ContentstackConfig,
} from '${PACKAGE}';
import { contentstackDelivery } from '${ENV_IMPORT_PATH}';

/**
 * Contentstack CMS feature (hybrid: SAP Commerce is the base for every page;
 * Contentstack overrides the slots you author). Generated by \`ng add\`.
 * Fill any <PLACEHOLDER> values in ${ENV_FILE_RELATIVE}, then import the Content
 * Model Starter Pack with the Contentstack CLI (csdx) — see GETTING_STARTED.md.
 *
 * The localeMapping and accessControl blocks below are scaffolded on purpose
 * (even at their defaults) so they're easy to find and turn on — a missing
 * localeMapping in particular is the usual cause of blank pages.
 */
@NgModule({
  imports: [ContentstackCmsFeatureModule],
  providers: [
    provideConfig(<ContentstackConfig>{
      contentstack: {
        // Delivery credentials live in ${ENV_FILE_RELATIVE} so secrets are not
        // committed inside this module.
        delivery: contentstackDelivery,
        cmsPageContentType: ${lit(options.cmsPageContentType, 'landing_page')},
        occFallback: ${occFallback},
        includeFallback: ${includeFallback},
        // Storefront language isocode -> the Contentstack locale your content is
        // authored in. IMPORTANT: with no matching entry the delivery query uses
        // the raw isocode (e.g. 'en'); if your stack has no such locale it returns
        // EMPTY content and pages render blank. These defaults match the starter
        // pack ('en-us' / 'de-de') — change them to your stack's locales.
        localeMapping: { en: 'en-us', de: 'de-de' },
        // Presentation-level content gating (show/hide entries by audience/role).
        // Off by default. To turn on: set enabled: true, tag entries in the
        // \`access_tags\` field, and provide CONTENTSTACK_CURRENT_USER so the
        // connector can read the signed-in user's roles. See CONTENT-MODEL.md.
        accessControl: { enabled: false },
      },
    }),
  ],
})
export class ${FEATURE_MODULE_CLASS} {}
`;
}
