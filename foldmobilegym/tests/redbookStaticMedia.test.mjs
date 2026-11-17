import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { prepareRedbookStaticMedia } from '../scripts/prepare_redbook_static_media.mjs';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'redbook-static-test-'));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('redbook-static-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const put = (relative, bytes) => {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  };
  const notes = JSON.stringify([{ cover: './images/posts/test/0.jpg', images: ['./images/posts/test/0.jpg'] }]);
  const image = Buffer.from('synthetic unit test bytes, not a bitmap');
  const imagePath = 'redbook/images/posts/test/0.jpg';
  const manifest = { schema_version: 1, notes_sha256: hash(notes), posts: 1, images: 1, bytes: image.length,
    files: [{ path: imagePath, bytes: image.length, sha256: hash(image) }] };
  const saveManifest = () => put('mobilegym-data/redbook/post-media.manifest.json', JSON.stringify(manifest));
  put('apps/RedBook/data/notes.json', notes);
  put(`mobilegym-data/${imagePath}`, image);
  for (const name of ['LICENSE', 'NOTICE', 'DISCLAIMER.md', 'README.md']) put(`mobilegym-data/${name}`, name);
  put('mobilegym-data/private-fixture.txt', 'must not be copied');
  saveManifest();
  return { root, put, manifest, saveManifest, imagePath };
}

test('whitelisted copy, check-only and repeat are deterministic', t => {
  const f = fixture(t);
  assert.equal(prepareRedbookStaticMedia(f.root, { checkOnly: true }).copied, 0);
  assert.equal(fs.existsSync(path.join(f.root, 'public')), false);
  assert.equal(prepareRedbookStaticMedia(f.root).copied, 6);
  assert.equal(fs.existsSync(path.join(f.root, 'public/cdn/private-fixture.txt')), false);
  assert.equal(prepareRedbookStaticMedia(f.root).copied, 0);
});

for (const kind of ['corrupt', 'missing', 'dataset', 'duplicate', 'traversal', 'unreferenced']) {
  test(`reject ${kind} before creating output`, t => {
    const f = fixture(t);
    if (kind === 'corrupt') f.put(`mobilegym-data/${f.imagePath}`, 'changed');
    if (kind === 'missing') fs.unlinkSync(path.join(f.root, 'mobilegym-data', f.imagePath));
    if (kind === 'dataset') f.put('apps/RedBook/data/notes.json', '[]');
    if (kind === 'duplicate') {
      f.manifest.files.push({ ...f.manifest.files[0] }); f.manifest.images = 2; f.saveManifest();
    }
    if (kind === 'traversal' || kind === 'unreferenced') {
      f.manifest.files[0].path = kind === 'traversal' ? '../escape.jpg' : 'redbook/images/posts/other/0.jpg';
      f.saveManifest();
    }
    assert.throws(() => prepareRedbookStaticMedia(f.root));
    assert.equal(fs.existsSync(path.join(f.root, 'public')), false);
  });
}

test('existing destination conflict is preserved', t => {
  const f = fixture(t);
  f.put(`public/cdn/${f.imagePath}`, 'user file');
  assert.throws(() => prepareRedbookStaticMedia(f.root), /differs/);
  assert.equal(fs.readFileSync(path.join(f.root, 'public/cdn', f.imagePath), 'utf8'), 'user file');
  assert.equal(fs.existsSync(path.join(f.root, 'public/cdn/LICENSE')), false);
});

test('destination directory junction is refused', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, 'public'));
  fs.mkdirSync(path.join(f.root, 'elsewhere'));
  fs.symlinkSync(path.join(f.root, 'elsewhere'), path.join(f.root, 'public/cdn'), 'junction');
  assert.throws(() => prepareRedbookStaticMedia(f.root), /link/);
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'elsewhere')), []);
});
