/*
 * DX-31556 (TC-1): the paragraph `content` fields are HTML rich text, and the
 * shipped content_types/*.json equal what generate-content-types.mjs emits.
 *
 * The generator writes next to itself, so the spec runs a copy of it inside a
 * temp directory and compares that output with the committed files. The
 * repository is never written to by the test.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHIPPED_DIR = join(__dirname, 'content_types');
const GENERATOR = join(__dirname, 'generate-content-types.mjs');
const PARAGRAPH_TYPES = ['cms_paragraph_component', 'cms_tab_paragraph_component'];

const readShipped = (uid: string): any => JSON.parse(readFileSync(join(SHIPPED_DIR, `${uid}.json`), 'utf8'));

describe('starter pack content types (DX-31556)', () => {
  let generatedDir: string;
  let workRoot: string;

  beforeAll(() => {
    workRoot = mkdtempSync(join(tmpdir(), 'starter-pack-'));
    const packDir = join(workRoot, 'import-export', 'starter-pack');
    mkdirSync(packDir, { recursive: true });
    copyFileSync(GENERATOR, join(packDir, 'generate-content-types.mjs'));
    execFileSync(process.execPath, [join(packDir, 'generate-content-types.mjs')], { stdio: 'pipe' });
    generatedDir = join(packDir, 'content_types');
  });

  afterAll(() => {
    rmSync(workRoot, { recursive: true, force: true });
  });

  it.each(PARAGRAPH_TYPES)('%s: content is an HTML rich-text field', (uid) => {
    const field = readShipped(uid).schema.find((f: any) => f.uid === 'content');
    expect(field).toBeDefined();
    expect(field.data_type).toBe('text');
    expect(field.field_metadata.allow_rich_text).toBe(true);
    expect(field.field_metadata.rich_text_type).toBe('custom');
    expect(field.field_metadata.options).toContain('html');
    expect(field.field_metadata.options).toEqual(expect.arrayContaining(['lists', 'h2', 'h3', 'h4', 'h5', 'h6']));
    expect(field.field_metadata).not.toHaveProperty('markdown');
    expect(field.field_metadata).not.toHaveProperty('multiline');
  });

  it('shipped content_types/*.json equal the generator output', () => {
    const shippedFiles = readdirSync(SHIPPED_DIR).filter((f) => f.endsWith('.json')).sort();
    const generatedFiles = readdirSync(generatedDir).filter((f) => f.endsWith('.json')).sort();
    expect(shippedFiles).toEqual(generatedFiles);
    for (const file of shippedFiles) {
      expect({ file, content: readFileSync(join(SHIPPED_DIR, file), 'utf8') }).toEqual({
        file,
        content: readFileSync(join(generatedDir, file), 'utf8'),
      });
    }
  });
});
