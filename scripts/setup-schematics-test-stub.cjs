#!/usr/bin/env node
/**
 * Compiles `test/stubs/spartacus-schematics.stub.ts` into a real
 * `node_modules/@spartacus/schematics` package. Needed because the schematics
 * ENGINE (`@angular-devkit/schematics`) `require()`s `@spartacus/schematics`
 * directly at Node runtime when `SchematicTestRunner` loads
 * `schematics/collection.json` — a tsconfig `paths` mapping or Jest
 * `moduleNameMapper` only affects TypeScript/Jest's own module resolution,
 * not the schematics engine's plain Node `require()`. See the stub file's
 * doc comment. Re-run after every `npm install` (which wipes `node_modules`).
 */
const { execFileSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'node_modules', '@spartacus', 'schematics');
const tsc = path.join(root, 'node_modules', '.bin', 'tsc');

mkdirSync(outDir, { recursive: true });

execFileSync(
  tsc,
  [
    path.join('test', 'stubs', 'spartacus-schematics.stub.ts'),
    '--outDir', outDir,
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'ES2021',
    '--experimentalDecorators',
    '--esModuleInterop',
    '--skipLibCheck',
    '--declaration',
  ],
  { cwd: root, stdio: 'inherit' },
);

writeFileSync(
  path.join(outDir, 'package.json'),
  JSON.stringify(
    {
      name: '@spartacus/schematics',
      version: '0.0.0-local-test-stub',
      description: 'LOCAL TEST STUB — see test/stubs/spartacus-schematics.stub.ts. Not the real @spartacus/schematics package (registry constraint, see README).',
      main: 'spartacus-schematics.stub.js',
      types: 'spartacus-schematics.stub.d.ts',
    },
    null,
    2,
  ),
);

console.log('Compiled node_modules/@spartacus/schematics test stub.');
