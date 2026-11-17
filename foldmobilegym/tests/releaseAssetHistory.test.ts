import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {build, preview} from 'vite';
import {assetPath, finishRelease, INVENTORY, readReleases, releaseAssetHistoryPlugin, releaseAssetResponsePlugin, snapshotHistory} from '../scripts/release_asset_history.mjs';

const roots: string[] = [];
function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'release-assets-test-'));
  roots.push(root); return root;
}
function emit(root: string, name: string, bytes: string) {
  const destination = path.join(root, name); fs.mkdirSync(path.dirname(destination), {recursive: true}); fs.writeFileSync(destination, bytes);
}
async function initial(root: string) {
  emit(root, 'index.html', '<!doctype html>');
  emit(root, 'assets/App-Old00001.js', 'export const old = 1;');
  emit(root, 'assets/App-Old00001.css', '.old { color: red }');
  const snapshot = await snapshotHistory({previous: path.join(path.dirname(root), 'missing'), output: root, allowedRoot: path.dirname(root)});
  try {await finishRelease(root, ['assets/App-Old00001.js', 'assets/App-Old00001.css'], snapshot);} finally {snapshot.cleanup();}
}
afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) {
    const parent = fs.realpathSync(os.tmpdir());
    if (!root.startsWith(parent + path.sep) || !path.basename(root).startsWith('release-assets-test-') || fs.realpathSync(root) !== root) throw Error('Unsafe test cleanup target');
    fs.rmSync(root, {recursive: true});
  }
});

describe('bounded immutable release assets', () => {
  it('accepts only contained fingerprinted asset names, not maps/private/path syntax', () => {
    const root = fixture();
    for (const name of ['../secret.js', 'assets/../private-Old00001.js', 'assets/sub/App-Old00001.js', 'assets/secret.json', 'assets/Code-Old00001.map', 'assets/%2Fsecret-Old00001.js']) expect(() => assetPath(root, name)).toThrow();
    expect(assetPath(root, 'assets/Shared-Old00001.json')).toBe(path.join(root, 'assets/Shared-Old00001.json'));
  });

  it('writes a private-path-free first inventory and verifies an explicit legacy source', async () => {
    const parent = fixture(), root = path.join(parent, 'first'); await initial(root);
    const raw = fs.readFileSync(path.join(root, INVENTORY), 'utf8');
    expect(raw).not.toContain(parent); expect((await readReleases(root)).length).toBe(1);
    const legacy = path.join(parent, 'legacy'); emit(legacy, 'index.html', '<!doctype html>'); emit(legacy, 'assets/Old-Legacy01.js', 'legacy');
    await expect(readReleases(legacy)).rejects.toThrow('no verified inventory');
    expect((await readReleases(legacy, {trustLegacy: true}))[0].assets).toHaveLength(1);
  });

  it('survives emptying the old output and keeps old bytes without overwriting current files', async () => {
    const parent = fixture(), root = path.join(parent, 'release'); await initial(root);
    const snapshot = await snapshotHistory({previous: root, output: root, allowedRoot: parent});
    try {
      fs.rmSync(path.join(root, 'assets'), {recursive: true});
      emit(root, 'assets/App-New00001.js', 'export const fresh = 2;');
      const result = await finishRelease(root, ['assets/App-New00001.js'], snapshot);
      expect(result.retained).toBe(2); expect(result.releases).toBe(2);
      expect(fs.readFileSync(path.join(root, 'assets/App-Old00001.js'), 'utf8')).toBe('export const old = 1;');
      expect(fs.readFileSync(path.join(root, 'assets/App-New00001.js'), 'utf8')).toContain('fresh');
    } finally {snapshot.cleanup();}
    expect(fs.readdirSync(parent).some(name => name.startsWith('.mobilegym-release-stage-'))).toBe(false);
  });

  it('bounds distinct prior generations instead of recursively retaining old history forever', async () => {
    const parent = fixture(), first = path.join(parent, 'first'), second = path.join(parent, 'second'), third = path.join(parent, 'third'); await initial(first);
    emit(second, 'assets/App-New00001.js', 'second');
    const a = await snapshotHistory({previous: first, output: second, allowedRoot: parent, keep: 1});
    try {await finishRelease(second, ['assets/App-New00001.js'], a);} finally {a.cleanup();}
    emit(third, 'assets/App-New00002.js', 'third');
    const b = await snapshotHistory({previous: second, output: third, allowedRoot: parent, keep: 1});
    try {await finishRelease(third, ['assets/App-New00002.js'], b);} finally {b.cleanup();}
    expect(fs.existsSync(path.join(third, 'assets/App-Old00001.js'))).toBe(false);
    expect(fs.readFileSync(path.join(third, 'assets/App-New00001.js'), 'utf8')).toBe('second');
    expect(await readReleases(third)).toHaveLength(2);
  });

  it('deduplicates identical rebuilds and enforces a byte budget before touching old output', async () => {
    const parent = fixture(), root = path.join(parent, 'release'); await initial(root);
    const names = (await readReleases(root))[0].assets.map(item => item.name);
    const a = await snapshotHistory({previous: root, output: root, allowedRoot: parent});
    try {await finishRelease(root, names, a);} finally {a.cleanup();}
    expect(await readReleases(root)).toHaveLength(1);
    await expect(snapshotHistory({previous: root, output: path.join(parent, 'next'), allowedRoot: parent, maxBytes: 1})).rejects.toThrow('budget');
    expect(fs.existsSync(path.join(root, 'assets/App-Old00001.js'))).toBe(true);
  });

  it('rejects changed old assets and metadata traversal instead of publishing them', async () => {
    const parent = fixture(), root = path.join(parent, 'release'); await initial(root);
    fs.writeFileSync(path.join(root, 'assets/App-Old00001.js'), 'changed');
    await expect(snapshotHistory({previous: root, output: path.join(parent, 'next'), allowedRoot: parent})).rejects.toThrow('integrity');
    const value = JSON.parse(fs.readFileSync(path.join(root, INVENTORY), 'utf8'));
    value.releases[0].assets[0].name = '../private-Old00001.js';
    value.releases[0].id = crypto.createHash('sha256').update(JSON.stringify(value.releases[0].assets)).digest('hex').slice(0, 24);
    fs.writeFileSync(path.join(root, INVENTORY), JSON.stringify(value));
    await expect(readReleases(root)).rejects.toThrow('metadata');
  });

  it('refuses a same-name different-byte collision without overwriting new content', async () => {
    const parent = fixture(), old = path.join(parent, 'old'), next = path.join(parent, 'next'); await initial(old);
    const snapshot = await snapshotHistory({previous: old, output: next, allowedRoot: parent});
    emit(next, 'assets/App-Old00001.js', 'different current content');
    try {await expect(finishRelease(next, ['assets/App-Old00001.js'], snapshot)).rejects.toThrow('collision');}
    finally {snapshot.cleanup();}
    expect(fs.readFileSync(path.join(next, 'assets/App-Old00001.js'), 'utf8')).toBe('different current content');
  });

  it('does not accept missing referenced files or an output outside its permitted root', async () => {
    const parent = fixture(), old = path.join(parent, 'old'); await initial(old);
    fs.unlinkSync(path.join(old, 'assets/App-Old00001.js'));
    await expect(snapshotHistory({previous: old, output: path.join(parent, 'next'), allowedRoot: parent})).rejects.toThrow();
    await expect(snapshotHistory({previous: old, output: path.dirname(parent), allowedRoot: parent})).rejects.toThrow('permitted');
  });

  it('checks a staged hardlink again and supports only an explicitly chosen no-history mode', async () => {
    const parent = fixture(), old = path.join(parent, 'old'), next = path.join(parent, 'next'); await initial(old);
    const snapshot = await snapshotHistory({previous: old, output: next, allowedRoot: parent});
    emit(next, 'assets/App-New00001.js', 'current');
    fs.writeFileSync(path.join(old, 'assets/App-Old00001.js'), 'mutated while building');
    try {await expect(finishRelease(next, ['assets/App-New00001.js'], snapshot)).rejects.toThrow('Snapshot changed');}
    finally {snapshot.cleanup();}
    const disabled = await snapshotHistory({previous: old, output: next, allowedRoot: parent, keep: 0});
    try {expect((await finishRelease(next, ['assets/App-New00001.js'], disabled)).releases).toBe(1);}
    finally {disabled.cleanup();}
  });
});

describe('actual Vite build lifecycle', () => {
  function project() {
    const parent = fixture(), root = path.join(parent, 'project');
    emit(root, 'index.html', '<script type="module" src="/entry.js"></script>');
    emit(root, 'entry.js', 'import "./style.css"; window.loadLater = () => import("./lazy.js");');
    emit(root, 'style.css', 'body { color: red }'); emit(root, 'lazy.js', 'export default "first";');
    return {parent, root};
  }
  const compile = (root: string) => build({root, configFile: false, logLevel: 'silent', plugins: [releaseAssetHistoryPlugin()], build: {outDir: 'dist', emptyOutDir: true, minify: false}});

  it('captures late CSS/chunks, retains a real prior build and cleans owned staging/locks', async () => {
    const {parent, root} = project(); await compile(root);
    const output = path.join(root, 'dist'), first = (await readReleases(output))[0];
    expect(first.assets.some(item => item.name.endsWith('.css'))).toBe(true);
    expect(first.assets.filter(item => item.name.endsWith('.js')).length).toBeGreaterThanOrEqual(2);
    emit(root, 'lazy.js', 'export default "second";'); await compile(root);
    const second = await readReleases(output); expect(second).toHaveLength(2);
    for (const item of first.assets) expect(fs.existsSync(path.join(output, item.name))).toBe(true);
    expect(fs.readdirSync(root).some(name => name.startsWith('.mobilegym-release-'))).toBe(false);
    expect(fs.readdirSync(parent).some(name => name.startsWith('.mobilegym-release-'))).toBe(false);
  });

  it('cleans owned locks on a failed build and leaves the previous release intact', async () => {
    const {root} = project(); await compile(root);
    const output = path.join(root, 'dist'), previous = fs.readFileSync(path.join(output, INVENTORY), 'utf8');
    emit(root, 'lazy.js', 'this is invalid syntax {'); await expect(compile(root)).rejects.toThrow();
    expect(fs.readFileSync(path.join(output, INVENTORY), 'utf8')).toBe(previous);
    expect(fs.readdirSync(root).some(name => name.startsWith('.mobilegym-release-'))).toBe(false);
  });

  it('refuses a project-root output before Vite can clear source files', async () => {
    const {root} = project();
    await expect(build({root, configFile: false, logLevel: 'silent', plugins: [releaseAssetHistoryPlugin()], build: {outDir: root, emptyOutDir: true}})).rejects.toThrow('source-directory');
    expect(fs.readFileSync(path.join(root, 'entry.js'), 'utf8')).toContain('loadLater');
  });

  it('does not remove another builder lock when concurrent acquisition fails', async () => {
    const {root} = project(), config = {root, build: {outDir: 'dist', emptyOutDir: true}, logger: {info: () => {}}};
    const first = releaseAssetHistoryPlugin(), second = releaseAssetHistoryPlugin();
    first.configResolved(config); second.configResolved(config);
    await first.buildStart();
    const lock = fs.readdirSync(root).find(name => name.endsWith('.lock'))!;
    try {
      await expect(second.buildStart()).rejects.toThrow('EEXIST'); second.closeBundle();
      expect(JSON.parse(fs.readFileSync(path.join(root, lock), 'utf8')).pid).toBe(process.pid);
    } finally {first.closeBundle();}
    expect(fs.existsSync(path.join(root, lock))).toBe(false);
  });

  it('returns correct prefixed JS/CSS responses and real 404/405 errors, not SPA HTML', async () => {
    const {root} = project(); await compile(root);
    const output = path.join(root, 'dist'), assets = (await readReleases(output))[0].assets;
    emit(output, 'assets/fonts/local.woff2', 'stable un-hashed public resource');
    const server = await preview({root, configFile: false, logLevel: 'silent', base: '/sim/', plugins: [releaseAssetResponsePlugin()], build: {outDir: 'dist'}, preview: {host: '127.0.0.1', port: 0, strictPort: true}});
    try {
      const port = (server.httpServer.address() as {port: number}).port, base = `http://127.0.0.1:${port}/sim/`;
      for (const extension of ['js', 'css']) {
        const item = assets.find(asset => asset.name.endsWith('.' + extension))!;
        const response = await fetch(base + item.name);
        expect(response.status).toBe(200); expect(response.headers.get('content-type')).not.toContain('text/html');
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('cache-control')).toContain('immutable');
        const absent = await fetch(base + `assets/Missing-NoFile01.${extension}`);
        expect(absent.status).toBe(404); expect(absent.headers.get('content-type')).toContain('text/plain');
        expect(absent.headers.get('cache-control')).toBe('no-store');
      }
      expect((await fetch(base + assets[0].name, {method: 'POST'})).status).toBe(405);
      const unHashed = await fetch(base + 'assets/fonts/local.woff2'); expect(unHashed.status).toBe(200);
      expect(unHashed.headers.get('cache-control')).not.toContain('immutable');
      const html = await fetch(base); expect(html.status).toBe(200); expect(html.headers.get('content-type')).toContain('text/html');
    } finally {await server.close();}
  });
});
