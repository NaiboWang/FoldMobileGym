/** Verify every local RedBook post image referenced by the read-only dataset. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaRoot = path.join(root, 'mobilegym-data', 'redbook');
const notes = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'RedBook', 'data', 'notes.json'), 'utf8'));
const issues = [];
let checkedImages = 0;

for (const note of notes) {
  if (!Array.isArray(note.images) || note.images.length === 0) {
    issues.push({ id: note.id, issue: 'Post has no images' });
    continue;
  }
  for (const raw of note.images) {
    const relative = String(raw).replace(/^\.\//, '');
    const filename = path.resolve(mediaRoot, relative);
    if (!filename.startsWith(`${mediaRoot}${path.sep}`)) {
      issues.push({ id: note.id, image: raw, issue: 'Image path escapes media root' });
      continue;
    }
    if (!fs.existsSync(filename)) {
      issues.push({ id: note.id, image: raw, issue: 'Image file is missing' });
      continue;
    }
    const size = fs.statSync(filename).size;
    if (size < 100) {
      issues.push({ id: note.id, image: raw, issue: `Image file is too small (${size} bytes)` });
      continue;
    }
    const first = Buffer.alloc(3);
    const last = Buffer.alloc(2);
    const fd = fs.openSync(filename, 'r');
    try {
      fs.readSync(fd, first, 0, first.length, 0);
      fs.readSync(fd, last, 0, last.length, size - last.length);
    } finally {
      fs.closeSync(fd);
    }
    if (first[0] !== 0xff || first[1] !== 0xd8 || first[2] !== 0xff
      || last[0] !== 0xff || last[1] !== 0xd9) {
      issues.push({ id: note.id, image: raw, issue: 'Invalid or truncated JPEG markers' });
      continue;
    }
    checkedImages += 1;
  }
}

console.log(JSON.stringify({ posts: notes.length, checkedImages, issueCount: issues.length, examples: issues.slice(0, 20) }, null, 2));
if (issues.length) process.exitCode = 1;
