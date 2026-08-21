/**
 * Real, runtime-backed local stand-in for `@spartacus/schematics`, used only to
 * exercise `schematics/add-contentstack/index.ts` via the real
 * `SchematicTestRunner`. The schematics ENGINE `require()`s `@spartacus/schematics`
 * at Node runtime when it loads `collection.json`, so a type-only shim isn't
 * enough — `scripts/setup-schematics-test-stub.cjs` compiles this into a real
 * `node_modules/@spartacus/schematics` before `npm run test:schematics`.
 *
 * Implements only the generic, registry-free helpers the connector's schematic
 * uses (`LibraryOptions`, `readPackageJson`, `validateSpartacusInstallation`,
 * `addPackageJsonDependenciesForLibrary`). The actual feature wiring lives in
 * the connector's own `configure.ts` (using `@schematics/angular` utilities),
 * not in Spartacus's `addFeatures` — so no stub is needed for that.
 */
import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';

export interface LibraryOptions {
  project: string;
  lazy?: boolean;
  features?: string[];
  debug?: boolean;
}

export function readPackageJson(tree: Tree): { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } {
  const content = tree.read('package.json');
  if (!content) {
    throw new Error('Could not find package.json');
  }
  return JSON.parse(content.toString('utf-8'));
}

export function validateSpartacusInstallation(packageJson: { dependencies?: Record<string, string> }): void {
  if (!packageJson.dependencies?.['@spartacus/core']) {
    throw new Error('@spartacus/core must be installed before adding the Contentstack feature.');
  }
}

export function addPackageJsonDependenciesForLibrary(peerDependencies: Record<string, string>, _options: LibraryOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const content = tree.read('package.json');
    if (!content) {
      throw new Error('Could not find package.json');
    }
    const packageJson = JSON.parse(content.toString('utf-8'));
    packageJson.dependencies = { ...packageJson.dependencies, ...peerDependencies };
    tree.overwrite('package.json', JSON.stringify(packageJson, null, 2));
    return tree;
  };
}
