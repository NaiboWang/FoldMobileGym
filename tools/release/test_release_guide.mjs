import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { validateReleaseGuide, resolveFrontendProject } from './release_guide.mjs';
const root = path.resolve('virtual-release-checkout');
function fixture(markdown, missing = []) {
  const directories = new Set(['', 'foldmobilegym', 'tools', 'tools/media', 'foldmobilegym/scripts']);
  const files = new Set(['foldmobilegym/package.json', 'foldmobilegym/package-lock.json', 'tools/media/install_media_package.py', 'foldmobilegym/scripts/smoke_reconstructed_build.mjs']);
  const rel = name => path.relative(root, name).split(path.sep).join('/');
  return validateReleaseGuide(markdown, { root, directoryExists: name => directories.has(rel(name)), fileExists: name => files.has(rel(name)) && !missing.includes(rel(name)) });
}
const block = (lines, language = 'powershell') => '```' + language + '\n' + lines.join('\n') + '\n```';
test('clone entry and nested frontend work even when checkout has a custom destination name', () => {
  const report = fixture(block(['git clone https://github.com/flyx-flyx/foldmobilegym.git', 'cd foldmobilegym', 'python tools/media/install_media_package.py --archive "C:\\Downloads\\media.tar.gz"', 'cd foldmobilegym', 'npm ci --no-audit --no-fund', 'npm run build']));
  assert.equal(report.passed, true); assert.equal(report.scripts.length, 1); assert.deepEqual(report.contexts.map(row => row.path), ['.', 'foldmobilegym']);
});
test('the stale mobilegym directory is rejected, not inferred as an alias', () => {
  const report = fixture(block(['cd mobilegym', 'npm ci', 'npm run build'])); assert.equal(report.passed, false);
  assert.match(report.errors[0], /directory does not exist.*mobilegym/); assert.ok(report.errors.some(error => error.includes('outside a package')));
});
test('Linux examples use the same real frontend and tool paths', () => {
  assert.equal(fixture(block(['git clone https://github.com/flyx-flyx/foldmobilegym.git', 'cd foldmobilegym', 'python3 tools/media/install_media_package.py --archive "$HOME/Downloads/media.tar.gz"', 'cd foldmobilegym', 'npm ci', 'npx tsc --noEmit'], 'bash')).passed, true);
});
test('a frontend smoke path is checked from its documented working directory', () => {
  const text = block(['cd foldmobilegym', 'node scripts/smoke_reconstructed_build.mjs http://127.0.0.1:3100/']);
  assert.equal(fixture(text).passed, true); assert.match(fixture(text, ['foldmobilegym/scripts/smoke_reconstructed_build.mjs']).errors[0], /script is absent/);
});
test('npm ci cannot silently run without the lockfile', () => { assert.equal(fixture(block(['cd foldmobilegym', 'npm ci']), ['foldmobilegym/package-lock.json']).passed, false); });
test('Windows npm.cmd and npx.cmd retain package and lockfile checks', () => {
  assert.equal(fixture(block(['cd foldmobilegym', 'npm.cmd ci', 'npm.cmd run build', 'npx.cmd tsc --noEmit'])).passed, true);
  assert.equal(fixture(block(['npm.cmd ci'])).passed, false);
  assert.equal(fixture(block(['npx.cmd tsc --noEmit'])).passed, false);
  assert.equal(fixture(block(['cd foldmobilegym', 'npm.cmd ci']), ['foldmobilegym/package-lock.json']).passed, false);
});
test('fenced code examples are independent repo-root sessions', () => {
  const text = block(['cd foldmobilegym', 'npm run build']) + '\n' + block(['npm run dev']); assert.equal(fixture(text).passed, false);
});
test('Markdown text, comments and data-only code blocks are never executed or treated as shell', () => {
  assert.equal(fixture('cd missing\n' + block(['# cd missing', 'cd foldmobilegym', 'npm run dev']) + '\n```text\ncd missing\n```').passed, true);
});
test('paths escaping the checkout and missing source scripts are rejected', () => {
  assert.equal(fixture(block(['cd ..'])).passed, false); assert.equal(fixture(block(['node tools/missing.mjs'])).passed, false);
});
test('standalone frontend is resolved from its package marker', () => {
  assert.equal(resolveFrontendProject(root, name => name === path.join(root, 'foldmobilegym/package.json')), path.join(root, 'foldmobilegym'));
});
test('a research Python foldagentgym directory is not confused with mobilegym frontend', () => {
  const present = new Set([path.join(root, 'foldagentgym/__init__.py'), path.join(root, 'mobilegym/package.json')]);
  assert.equal(resolveFrontendProject(root, name => present.has(name)), path.join(root, 'mobilegym'));
});
test('two package markers are refused rather than choosing a stale copy', () => { assert.throws(() => resolveFrontendProject(root, () => true), /found 2/); });
test('a missing frontend is not invented from a directory name', () => { assert.throws(() => resolveFrontendProject(root, () => false), /found 0/); });
