import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSource, runtimeModules } from './check_source.mjs';

function fixture(t, files = [{ path: 'apps/Demo/data/defaults.json' }]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'receiver-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'SOURCE_SNAPSHOT.json'), JSON.stringify({ files }));
  return root;
}

test('rejects empty, unsafe and duplicate foundation inventories', t => {
  for (const files of [[], [{ path: '../outside' }], [{ path: '/outside' }],
    [{ path: 'C:/outside' }], [{ path: 'apps\\outside' }], [{ path: 'a' }, { path: 'a' }]]) {
    assert.throws(() => checkSource(fixture(t, files)), /Empty|Unsafe/);
  }
});

test('overlay-only source cannot pass completeness', t => {
  assert.throws(() => checkSource(fixture(t)), /Incomplete source/);
});

test('requires all fourteen runtime modules and both entry imports', t => {
  const root = fixture(t);
  const files = [...runtimeModules, 'apps/Demo/data/defaults.json', 'package.json',
    'package-lock.json', 'index.html', 'index.tsx', 'vite.config.ts', 'tsconfig.json',
    'DATA_SNAPSHOT.json', 'LICENSE', 'NOTICE'];
  for (const name of files) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), 'fixture');
  }
  assert.throws(() => checkSource(root), /Runtime entry import missing/);
  fs.writeFileSync(path.join(root, 'index.tsx'), "import './foldagent';\nimport './foldagent_benchmark';\n");
  assert.equal(checkSource(root).foldagent_modules, 14);
  fs.unlinkSync(path.join(root, 'foldagent_evaluator.ts'));
  assert.throws(() => checkSource(root), /Incomplete source/);
});
