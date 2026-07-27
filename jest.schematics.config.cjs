/*
 * Dedicated Jest config for the `ng-add` schematic test
 * (`schematics/add-contentstack/index.schematic.spec.ts`), kept separate from
 * `jest.config.cjs` (which only matches normalizer spec files, per its own
 * doc comment on why TestBed-requiring specs are excluded). The schematic
 * doesn't need Angular's TestBed at all — only the real, genuinely-installable
 * `@angular-devkit/schematics` engine — so it gets its own light config
 * instead of stretching the normalizer-scoped one.
 *
 * Run: npm run test:schematics (runs `pretest:schematics` first, which
 * compiles `test/stubs/spartacus-schematics.stub.ts` into a real
 * `node_modules/@spartacus/schematics` — required because the schematics
 * engine `require()`s it directly at Node runtime, which a Jest
 * `moduleNameMapper` can't reach).
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/schematics'],
  testMatch: ['**/*.schematic.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
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
          resolveJsonModule: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // `ora` (ESM-only) is a transitive dependency of
  // @angular-devkit/schematics/tasks' NodePackageInstallTask executor, pulled
  // in merely by importing SchematicTestRunner — not something this test
  // exercises. Map it to a trivial no-op mock rather than teaching Jest's
  // CJS transform to parse an ESM dependency chain.
  moduleNameMapper: {
    '^ora$': '<rootDir>/test/stubs/ora.stub.js',
  },
};
