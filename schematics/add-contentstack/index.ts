/**
 * `ng add @contentstack/contentstack-spartacus-connector` schematic.
 *
 * Unlike official Spartacus feature libs, this connector does NOT delegate to
 * `addFeatures` from `@spartacus/schematics` — that resolves a per-feature
 * `SchematicConfig` from a registry baked inside `@spartacus/schematics`, which
 * a third-party library cannot add to. Instead we reuse only the generic,
 * registry-free helpers (validate + dependency install) and wire the feature
 * ourselves (see `./configure`).
 */
import { Rule, SchematicContext, Tree, chain } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import {
  LibraryOptions,
  addPackageJsonDependenciesForLibrary,
  readPackageJson,
  validateSpartacusInstallation,
} from '@spartacus/schematics';
import { peerDependencies } from '../../package.json';
import { configureContentstackFeature } from './configure';

/** Options for the Contentstack `ng add` schematic (see `schema.json`). */
export interface SpartacusContentstackOptions extends LibraryOptions {
  /** Contentstack stack API key (read-only, client-safe). */
  apiKey?: string;
  /** Contentstack delivery token (read-only, environment-scoped). */
  deliveryToken?: string;
  /** Publishing environment (e.g. `development`). */
  environment?: string;
  /** Data-center region key (US | EU | AZURE-NA | AZURE-EU | GCP-NA | GCP-EU). */
  region?: string;
  /** Enable Live Preview / Visual Builder wiring. */
  livePreview?: boolean;
  /** Preview token (used only when `livePreview` is enabled). */
  previewToken?: string;
  /** Fall back to master-locale content for untranslated entries. */
  includeFallback?: boolean;
  /** Hybrid: fall back to SAP (OCC) for content not in Contentstack (default true). */
  occFallback?: boolean;
  /** Page content type resolved for content/landing routes. */
  cmsPageContentType?: string;
}

export function addContentstackFeatures(options: SpartacusContentstackOptions): Rule {
  return (tree: Tree, context: SchematicContext): Rule => {
    validateSpartacusInstallation(readPackageJson(tree));

    // Install the connector's peer deps into the app.
    context.addTask(new NodePackageInstallTask());

    return chain([
      configureContentstackFeature(options),
      addPackageJsonDependenciesForLibrary(peerDependencies, options),
    ]);
  };
}
