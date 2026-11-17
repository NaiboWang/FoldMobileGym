import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

// Runtime defaults provide classes that cannot be inferred from JSX alone.
test('Tailwind includes data-driven book-cover utilities without documentation examples', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const defaults = JSON.parse(fs.readFileSync(path.join(root, 'apps/WechatReading/data/defaults.json'), 'utf8'));
  const coverClasses = new Set<string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) {
        if (key === 'coverColor' && typeof nested === 'string' && nested.startsWith('bg-')) coverClasses.add(nested);
        collect(nested);
      }
    }
  };
  collect(defaults);
  expect(coverClasses.size).toBeGreaterThan(1);
  expect([...coverClasses].some(value => value.includes('4D332D'))).toBe(true);
  // Check literal background utilities across each app's defaults as well.
  const backgroundClasses = new Set<string>();
  const backgroundPattern = /^bg-(?:[A-Za-z][A-Za-z0-9-]*|\[[^\s\]]+\]|\(--[a-zA-Z0-9-]+\))$/;
  const collectBackgrounds = (value: unknown): void => {
    if (typeof value === 'string' && backgroundPattern.test(value)) backgroundClasses.add(value);
    else if (Array.isArray(value)) value.forEach(collectBackgrounds);
    else if (value && typeof value === 'object') Object.values(value).forEach(collectBackgrounds);
  };
  for (const namespace of ['apps', 'system']) {
    for (const entry of fs.readdirSync(path.join(root, namespace), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const filename = path.join(root, namespace, entry.name, 'data/defaults.json');
      if (fs.existsSync(filename)) collectBackgrounds(JSON.parse(fs.readFileSync(filename, 'utf8')));
    }
  }
  expect(backgroundClasses.size).toBeGreaterThanOrEqual(coverClasses.size);
  const cli = path.join(root, 'node_modules/@tailwindcss/cli/dist/index.mjs');
  const css = execFileSync(process.execPath, [cli, '-i', path.join(root, 'app.css')], {
    cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  const selectorFor = (utility: string) => '.' + utility.replace(/([^a-zA-Z0-9_-])/g, char => String.fromCharCode(92) + char);
  for (const utility of backgroundClasses) expect(css, `Missing generated class ${utility}`).toContain(selectorFor(utility));
  // Construct the placeholder from fragments so this test does not itself become a source of that utility.
  const documentationExample = ['h-', '[N', 'px]'].join('');
  expect(css).not.toContain(selectorFor(documentationExample));
}, 30_000);
