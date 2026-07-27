#!/usr/bin/env node
/**
 * Removes compiled schematics artifacts (`.js`, `.js.map`, `.d.ts`) so a stale
 * emit from a since-deleted `.ts` can never ship. Node-based (no `rimraf` dep) so
 * it runs anywhere `npm run build:schematics` does.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'schematics');
const RE = /\.(js|js\.map|d\.ts)$/;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (RE.test(entry.name)) fs.rmSync(full);
  }
}

walk(root);
