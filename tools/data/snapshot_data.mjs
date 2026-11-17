// Maintainer-only: record the full served dataset and any differences from the release.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [sourceArg, projectArg, baselineArg] = process.argv.slice(2);
if (!sourceArg || !projectArg) throw Error('Usage: node snapshot_data.mjs DATA_SOURCE PROJECT [EXTRACTED_RELEASE]');
const source = fs.realpathSync(sourceArg), project = fs.realpathSync(projectArg);
const baseline = baselineArg && fs.realpathSync(baselineArg);
const files = [], patches = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function walk(relative = '') {
  for (const entry of fs.readdirSync(path.join(source, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw Error(`Unexpected dataset link: ${name}`);
    if (entry.isDirectory()) { walk(name); continue; }
    if (!entry.isFile()) throw Error(`Unsupported dataset entry: ${name}`);
    const bytes = fs.readFileSync(path.join(source, name)), sha256 = hash(bytes);
    files.push({ path: name, bytes: bytes.length, sha256 });
    if (baseline) {
      const basePath = path.join(baseline, name);
      if (!fs.existsSync(basePath) || hash(fs.readFileSync(basePath)) !== sha256) {
        // RedBook post images/notices are already in the tracked legacy media package.
        const legacy = path.join(project, '..', 'mobilegym_overlay/mobilegym-data', name);
        if (!fs.existsSync(legacy) || hash(fs.readFileSync(legacy)) !== sha256) {
          const target = path.join(project, 'media_patch', name);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          if (fs.existsSync(target) && hash(fs.readFileSync(target)) !== sha256) throw Error(`Patch conflict: ${name}`);
          if (!fs.existsSync(target)) fs.copyFileSync(path.join(source, name), target, fs.constants.COPYFILE_EXCL);
          patches.push({ path: name, bytes: bytes.length, sha256 });
        }
      }
    }
  }
}
walk();
fs.writeFileSync(path.join(project, 'DATA_SNAPSHOT.json'), JSON.stringify({
  schema_version: 1, release: 'data-v0.1.0',
  archive_sha256: '933a8499c71450f135eda70f9107af72b56b42181fc62de76ed1aa4c513a603c',
  bytes: files.reduce((sum, file) => sum + file.bytes, 0), files,
}, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  patches: patches.length, patch_bytes: patches.reduce((sum, file) => sum + file.bytes, 0) }));
