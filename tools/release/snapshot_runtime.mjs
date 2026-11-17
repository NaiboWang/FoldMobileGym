// Maintainer-only exporter. Consumer builds do not run this script.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg) throw Error('Usage: node snapshot_runtime.mjs SOURCE NEW_DESTINATION');
const source = fs.realpathSync(sourceArg), destination = path.resolve(destinationArg);
if (fs.existsSync(destination)) throw Error('Destination must not exist; refusing to overwrite');
const directories = ['apps', 'os', 'system', 'assets', 'public', 'web', 'scripts', 'tests', 'docs', 'bench_env'];
const rootFiles = ['.env.example', 'AGENTS.md', 'app.css', 'index.css', 'index.html', 'index.tsx',
  'LICENSE', 'LICENSE-DATA', 'NOTICE', 'DISCLAIMER.md', 'CONTRIBUTING.md', 'README.md', 'README_zh.md',
  'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.ts',
  'vitest.config.ts', 'eslint.config.js'];
rootFiles.push(...fs.readdirSync(source).filter(name => /^foldagent.*\.ts$/.test(name)));
const trackedSdcard = new Set(execFileSync('git', ['-C', source, 'ls-files', '-z', 'public/sdcard'], { encoding: 'utf8' }).split('\0').filter(Boolean));
const excluded = [];
const plan = [];
function visit(relative) {
  const absolute = path.join(source, relative), info = fs.lstatSync(absolute);
  if (info.isSymbolicLink()) throw Error(`Links are not deliverable: ${relative}`);
  if ((/(^|\/)(node_modules|__pycache__|\.pytest_cache|\.cache|artifacts|runs|screenshots|trajectories|fixtures)(\/|$)/.test(relative)
      && !['tests/fixtures', 'tests/fixtures/objectContainsCases.json'].includes(relative))
    || relative.startsWith('public/cdn/') || relative === 'public/cdn'
    || /\.(log|pyc|pem|key|zip|tar\.gz)$/.test(relative)
    || (relative.startsWith('public/sdcard/') && info.isFile() && !trackedSdcard.has(relative))) {
    excluded.push(relative); return;
  }
  if (info.isDirectory()) {
    for (const name of fs.readdirSync(absolute).sort()) visit(`${relative}/${name}`);
    return;
  }
  if (!info.isFile() || info.size > 95 * 1024 * 1024) throw Error(`Unsupported file: ${relative}`);
  const bytes = fs.readFileSync(absolute);
  if (/\.(ts|tsx|js|mjs|cjs|py|json|html|css|sh)$/.test(relative)) {
    const content = bytes.toString('utf8');
    const secret = /\b(?:gh[pousr]_[A-Za-z0-9]{24,}|sk-[A-Za-z0-9_-]{32,}|AKIA[A-Z0-9]{16})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/;
    if (secret.test(content)) throw Error(`Possible credential; review without printing its value: ${relative}`);
    const googleKeys = content.match(/AIza[0-9A-Za-z_-]{35}/g) || [];
    if (googleKeys.some(key => !key.startsWith('AIzaSyOfflineMapCacheOnly'))) throw Error(`Possible Google key: ${relative}`);
  }
  plan.push({ path: relative, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
for (const relative of [...rootFiles, ...directories]) visit(relative);
for (const file of plan) {
  const target = path.join(destination, file.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(source, file.path), target, fs.constants.COPYFILE_EXCL);
}
fs.writeFileSync(path.join(destination, 'SOURCE_SNAPSHOT.json'), JSON.stringify({
  schema_version: 1, upstream: 'https://github.com/Purewhiter/mobilegym',
  upstream_commit: execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  note: 'Actual modified runtime snapshot; not a pristine upstream checkout. Hashes describe export before delivery tooling changes.',
  excluded, files: plan,
}, null, 2) + '\n');
console.log(JSON.stringify({ files: plan.length, bytes: plan.reduce((sum, file) => sum + file.bytes, 0), excluded: excluded.length }));
