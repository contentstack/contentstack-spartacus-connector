// @ts-check
// Flat ESLint config for the Contentstack Spartacus connector.
//
// Type-UNAWARE linting on purpose: we do NOT set `parserOptions.project`, so
// ESLint never has to resolve @spartacus/* (registry-gapped — see .npmrc /
// tsconfig.typecheck.json). Type correctness is covered separately by
// `npm run typecheck`; this config catches lint-level issues only.
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Not source we own / not lintable as library TS.
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'typings/**',
      'scripts/**',
      'import-export/**',
      'schematics/**/*.js',
      'schematics/**/*.js.map',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      // Must stay LAST: turns off rules that conflict with Prettier formatting.
      prettier,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Library uses the `cs` selector prefix (cs-custom-hero, [csEditable],
      // [csEmptyBlockParent]).
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'cs', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'cs', style: 'kebab-case' },
      ],
      // The connector maps loosely-typed Delivery-API JSON (index signatures,
      // unresolved references), so `any` is sometimes unavoidable at the SDK
      // boundary. Surface it as a warning rather than blocking the build.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // `const { a, b, ...rest } = x` destructure-to-omit is intentional
          // (see contentstack-field-mapper stripAuthoringKeys).
          ignoreRestSiblings: true,
        },
      ],
      // `interface Config extends ContentstackConfig {}` is the Spartacus
      // ambient module-augmentation idiom, not a redundant empty interface.
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
      // Existing code uses constructor injection. Migrating to inject() is a
      // deliberate, separate refactor — surface it, don't block on it.
      '@angular-eslint/prefer-inject': 'warn',
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      // Test doubles / stubs legitimately use `any`, non-null assertions,
      // empty function bodies, and throwaway generic params.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // @if/@for migration in the example template is a separate task.
      '@angular-eslint/template/prefer-control-flow': 'warn',
    },
  },
);
