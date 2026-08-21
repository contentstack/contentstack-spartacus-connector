#!/usr/bin/env node
/**
 * Post-`ng-packagr` fixups for the publishable `dist/`.
 *
 * ng-packagr writes `"type": "module"` into `dist/package.json` (the library is
 * ESM, shipped as `.mjs`). But the `ng add` schematics are compiled to CommonJS
 * `.js` (the Angular schematics engine loads them via `require`). Under a
 * `"type": "module"` package those `.js` files would be read as ESM and crash
 * with "exports is not defined in ES module scope".
 *
 * Fix: drop a nested `dist/schematics/package.json` declaring `"type": "commonjs"`
 * so Node treats just that subtree as CommonJS. ng-packagr's generated
 * `.npmignore` strips every nested `package.json`, so we also re-include this one
 * (and make sure stray packed tarballs never end up inside the next tarball).
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');
const schematicsDir = path.join(dist, 'schematics');

if (!fs.existsSync(schematicsDir)) {
  throw new Error(
    `[finalize-dist] ${schematicsDir} not found — did ng-packagr copy the schematics assets? ` +
      `Check ng-package.json "assets".`
  );
}

fs.writeFileSync(
  path.join(schematicsDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n'
);

fs.writeFileSync(
  path.join(dist, '.npmignore'),
  [
    '# Nested package.json files are dev-only — except the schematics one, which',
    '# marks the compiled schematics as CommonJS inside this ESM package.',
    '**/package.json',
    '!schematics/package.json',
    '# Never ship a packed tarball that was written into dist.',
    '*.tgz',
    '',
  ].join('\n')
);

console.log(
  '[finalize-dist] wrote dist/schematics/package.json (type: commonjs) and patched dist/.npmignore'
);
