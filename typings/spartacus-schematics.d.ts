/*
 * Minimal type shim for `@spartacus/schematics`, used only for offline
 * typechecking + the schematics build in this workspace (the package is
 * registry-gapped here, same as `@spartacus/core` — see `spartacus.d.ts`; it is
 * a real dependency at consumer runtime). Mirrors only the generic,
 * registry-free helpers the `ng add` schematic actually uses. The connector
 * does NOT use `addFeatures` (that needs a feature-config registered inside
 * `@spartacus/schematics`, impossible for a third-party lib) — it wires the
 * feature with its own rules instead. Remove this shim once the dependency is
 * installed for real.
 */
declare module '@spartacus/schematics' {
  import { Rule, Tree } from '@angular-devkit/schematics';

  /** Base options every Spartacus feature `ng add` extends. */
  export interface LibraryOptions {
    project: string;
    lazy?: boolean;
    features?: string[];
    debug?: boolean;
  }

  export function readPackageJson(tree: Tree): {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  export function validateSpartacusInstallation(packageJson: {
    dependencies?: Record<string, string>;
  }): void;
  export function addPackageJsonDependenciesForLibrary(
    peerDependencies: Record<string, string>,
    options: LibraryOptions
  ): Rule;
}
