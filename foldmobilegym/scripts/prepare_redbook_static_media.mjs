// Prepare the whitelisted companion media as generated public/CDN assets.
// Existing Vite build commands and app URLs remain unchanged.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function noLinks(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Media path escapes project');
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw Error(`Media path contains link: ${current}`);
  }
}

export function prepareRedbookStaticMedia(projectRoot, { checkOnly = false } = {}) {
  const root = fs.realpathSync(projectRoot);
  const sourceRoot = path.join(root, 'mobilegym-data');
  const destinationRoot = path.join(root, 'public/cdn');
  const manifestPath = path.join(sourceRoot, 'redbook/post-media.manifest.json');
  noLinks(root, manifestPath);
  noLinks(root, destinationRoot);
  if (!fs.existsSync(manifestPath)) throw Error('Missing RedBook image manifest; merge the supplied mobilegym-data before building');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.files)
    || manifest.files.length !== manifest.images) throw Error('Invalid RedBook image manifest');
  const notesBytes = fs.readFileSync(path.join(root, 'apps/RedBook/data/notes.json'));
  if (sha(notesBytes) !== manifest.notes_sha256) throw Error('RedBook dataset does not match supplied media');
  const notes = JSON.parse(notesBytes.toString('utf8'));
  if (notes.length !== manifest.posts) throw Error('RedBook post count mismatch');
  const references = new Set(notes.flatMap(note => [note.cover, ...(note.images || [])]).filter(Boolean)
    .map(reference => `redbook/${reference.replace(/^\.\//, '')}`));
  const plan = [], seen = new Set();
  let imageBytes = 0;
  for (const file of manifest.files) {
    if (!/^redbook\/images\/posts\/[a-z0-9_-]+\/\d+\.(jpe?g|png|webp)$/i.test(file.path)
      || seen.has(file.path) || !references.has(file.path)
      || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0) {
      throw Error('Invalid or unreferenced RedBook image entry');
    }
    seen.add(file.path);
    plan.push({ relative: file.path, expectedHash: file.sha256, expectedBytes: file.bytes });
    imageBytes += file.bytes;
  }
  if (seen.size !== references.size || imageBytes !== manifest.bytes) throw Error('Incomplete RedBook image manifest');
  for (const relative of ['LICENSE', 'NOTICE', 'DISCLAIMER.md', 'README.md', 'redbook/post-media.manifest.json']) {
    plan.push({ relative });
  }
  // Validate the complete plan before writing anything, including destination conflicts.
  for (const item of plan) {
    item.source = path.join(sourceRoot, item.relative);
    item.destination = path.join(destinationRoot, item.relative);
    noLinks(root, item.source); noLinks(root, item.destination);
    const bytes = fs.readFileSync(item.source);
    item.hash = sha(bytes);
    if (!bytes.length || (item.expectedHash && (item.hash !== item.expectedHash || bytes.length !== item.expectedBytes))) {
      throw Error(`Missing or corrupt packaged media: ${item.relative}`);
    }
    item.exists = fs.existsSync(item.destination);
    if (item.exists && sha(fs.readFileSync(item.destination)) !== item.hash) throw Error(`Existing generated asset differs: ${item.relative}`);
  }
  let copied = 0;
  if (!checkOnly) for (const item of plan) {
    if (!item.exists) {
      fs.mkdirSync(path.dirname(item.destination), { recursive: true });
      fs.copyFileSync(item.source, item.destination, fs.constants.COPYFILE_EXCL);
      copied++;
    }
    if (sha(fs.readFileSync(item.destination)) !== item.hash) throw Error(`Static media copy mismatch: ${item.relative}`);
  }
  return { passed: true, checkOnly, images: seen.size, bytes: imageBytes, copied,
    scope: 'Generated public/cdn post images and original notices only' };
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prepareRedbookStaticMedia(process.cwd(), { checkOnly: process.argv.includes('--check-only') })));
}
