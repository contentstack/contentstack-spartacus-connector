/*
 * Offline unit-test config for the pure-logic normalizer specs.
 *
 * Runs with ts-jest (transpile-only) and maps the uninstalled @spartacus /
 * @contentstack / @angular packages to lightweight runtime stubs, so the core
 * Contentstack→Spartacus transform is testable with no network install and no
 * Angular runtime. Type-safety is covered separately by `npm run typecheck`.
 *
 * The TestBed-based specs (contentstack-cms.module.spec, custom-hero.component
 * .spec) require the full Angular + Spartacus runtime and are intentionally NOT
 * matched here — run those inside the integrated Spartacus host app (see README
 * → Verification, Level 2/3).
 *
 * Run (reusing the Spartacus toolchain, no install needed):
 *   ../spartacus/node_modules/.bin/jest -c jest.config.cjs
 * Or, after `npm install`:  npm test
 */
const path = require('path');

// Reuse ts-jest from the sibling Spartacus workspace when this library has no
// node_modules of its own; fall back to a normal resolution after npm install.
let tsJest;
try {
  tsJest = require.resolve('ts-jest');
} catch {
  tsJest = path.resolve(__dirname, '../spartacus/node_modules/ts-jest');
}

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Pure-logic specs only (no TestBed). The `*.livepreview.spec.ts` glob covers
  // framework-free Live Preview helper tests (e.g. entry tagging); `type-guards
  // .spec.ts` and `merge-structures.spec.ts` are the other framework-free
  // model-layer helper specs. The TestBed-requiring specs
  // (contentstack-cms.module.spec, custom-hero.component.spec) remain
  // intentionally unmatched — run those in a real Spartacus host.
  testMatch: [
    '**/*.normalizer.spec.ts',
    '**/*.livepreview.spec.ts',
    '**/*field-mapper.spec.ts',
    '**/*.adapter.spec.ts',
    '**/type-guards.spec.ts',
    '**/merge-structures.spec.ts',
  ],
  transform: {
    '^.+\\.ts$': [
      tsJest,
      {
        tsconfig: {
          isolatedModules: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          target: 'ES2022',
          module: 'CommonJS',
          moduleResolution: 'node',
          esModuleInterop: true,
          useDefineForClassFields: false,
          importHelpers: false,
          skipLibCheck: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@spartacus/core$': '<rootDir>/test/stubs/spartacus-core.stub.ts',
    '^@angular/core$': '<rootDir>/test/stubs/angular-core.stub.ts',
    '^@angular/common$': '<rootDir>/test/stubs/angular-common.stub.ts',
    '^@contentstack/delivery-sdk$':
      '<rootDir>/test/stubs/contentstack-delivery-sdk.stub.ts',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Fall back to the sibling Spartacus workspace for any other runtime module
  // (e.g. tslib) when this library has no node_modules of its own.
  moduleDirectories: [
    'node_modules',
    path.resolve(__dirname, '../spartacus/node_modules'),
  ],
};
