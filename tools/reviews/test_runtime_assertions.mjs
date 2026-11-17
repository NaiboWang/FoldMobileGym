import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertEntryHealth, assertMediaBytes } from './runtime_assertions.mjs';

test('receiver runtime rejects overflow, broken and unfinished visible images', () => {
  assertEntryHealth({ overflow: false, failedImages: [] }, 'folded', 'demo');
  assert.throws(() => assertEntryHealth({ overflow: true, failedImages: [] }, 'folded', 'demo'), /folded\/demo: outer/);
  assert.throws(() => assertEntryHealth({ overflow: false, failedImages: ['/bad.jpg'] }, 'unfolded', 'demo'), /unfolded\/demo: visible image/);
});

test('receiver media gate rejects equal-sized corrupt content as well as truncation', () => {
  const bytes = Buffer.from('test');
  const item = { path: 'demo.bin', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  assertMediaBytes(bytes, item);
  assert.throws(() => assertMediaBytes(Buffer.from('bad!'), item), /demo.bin/);
  assert.throws(() => assertMediaBytes(Buffer.from('tes'), item), /demo.bin/);
});
