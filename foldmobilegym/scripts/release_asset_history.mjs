import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const INVENTORY = 'mobilegym-release-assets.json';
const ASSET = /^assets\/[A-Za-z0-9_][A-Za-z0-9_.-]*-[A-Za-z0-9_-]{8,}\.(?:js|css|json|wasm|woff2?|ttf|otf|png|jpe?g|gif|webp|avif|svg|ico|mp3|ogg|mp4)$/;
const pathKey = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
const samePath = (a, b) => pathKey(a) === pathKey(b);
const isInside = (child, parent) => pathKey(child).startsWith(pathKey(parent) + path.sep);

export function assetPath(root, name) {
  if (!ASSET.test(name)) throw Error('Not a supported hashed release asset: ' + name);
  const filename = path.resolve(root, name);
  if (!filename.startsWith(path.resolve(root, 'assets') + path.sep)) throw Error('Asset escapes its directory');
  return filename;
}

async function digestFile(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

function regularFile(root, name) {
  const filename = assetPath(root, name), stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || !samePath(fs.realpathSync(filename), filename)) throw Error('Release asset is not a regular contained file: ' + name);
  return {filename, stat};
}

export async function inventoryAssets(root, names) {
  const assets = [];
  for (const name of [...new Set(names)].sort()) {
    const {filename, stat} = regularFile(root, name);
    assets.push({name, bytes: stat.size, sha256: await digestFile(filename)});
  }
  return assets;
}

function releaseId(assets) {
  return crypto.createHash('sha256').update(JSON.stringify(assets)).digest('hex').slice(0, 24);
}

function validateInventory(value) {
  if (value?.version !== 1 || !Array.isArray(value.releases) || value.releases.length > 33) throw Error('Invalid release asset inventory');
  for (const release of value.releases) {
    if (!Array.isArray(release.assets) || release.assets.length > 5000 || release.id !== releaseId(release.assets)) throw Error('Invalid release inventory identity');
    const seen = new Set();
    for (const item of release.assets) {
      if (!ASSET.test(item.name) || seen.has(item.name) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !/^[a-f0-9]{64}$/.test(item.sha256)) throw Error('Invalid release asset metadata');
      seen.add(item.name);
    }
  }
  return value.releases;
}

/** Only explicitly trusted legacy build directories may be bootstrapped. */
export async function readReleases(root, {trustLegacy = false} = {}) {
  if (!fs.existsSync(root)) return [];
  const filename = path.join(root, INVENTORY);
  if (fs.existsSync(filename)) {
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8 * 1024 * 1024) throw Error('Unsafe release inventory');
    return validateInventory(JSON.parse(fs.readFileSync(filename, 'utf8')));
  }
  if (!trustLegacy) {
    if (fs.existsSync(path.join(root, 'index.html')) || fs.existsSync(path.join(root, 'assets'))) throw Error('Previous release has no verified inventory; explicitly approve a trusted legacy build or choose an explicit no-history policy');
    return [];
  }
  if (!fs.lstatSync(path.join(root, 'index.html')).isFile()) throw Error('Legacy source is not a built release');
  const names = fs.readdirSync(path.join(root, 'assets')).map(name => 'assets/' + name).filter(name => ASSET.test(name));
  const assets = await inventoryAssets(root, names);
  if (!assets.length) throw Error('Legacy source has no eligible hashed assets');
  return [{id: releaseId(assets), assets}];
}

function requireContainedDirectory(directory, allowedRoot) {
  const absolute = path.resolve(directory), allowed = path.resolve(allowedRoot);
  if (!isInside(absolute, allowed) || ['apps', 'os', 'system', 'public', 'scripts', 'tests', 'web', 'node_modules', 'foldmobilegym', '.git'].includes(path.basename(absolute).toLowerCase())) throw Error('Release directory is outside the permitted build area');
  let existing = absolute;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  if (!samePath(fs.realpathSync(existing), existing)) throw Error('Release directories cannot traverse symlinks');
  return absolute;
}

/** Snapshots use hardlinks outside outDir, so Vite may safely empty outDir. */
export async function snapshotHistory({previous, output, allowedRoot, keep = 8, maxBytes = 512 * 1024 * 1024, trustLegacy = false}) {
  if (!Number.isInteger(keep) || keep < 0 || keep > 32 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw Error('Invalid release retention budget');
  output = requireContainedDirectory(output, allowedRoot);
  previous = requireContainedDirectory(previous, allowedRoot);
  const releases = keep === 0 ? [] : (await readReleases(previous, {trustLegacy})).slice(0, keep);
  const records = new Map();
  let total = 0;
  for (const release of releases) for (const item of release.assets) {
    const prior = records.get(item.name);
    if (prior && (prior.sha256 !== item.sha256 || prior.bytes !== item.bytes)) throw Error('Conflicting retained asset identity: ' + item.name);
    if (!prior) {records.set(item.name, item); total += item.bytes;}
  }
  if (total > maxBytes) throw Error(`Retained assets exceed budget (${total} > ${maxBytes}); choose an explicit retention policy before publishing`);
  fs.mkdirSync(path.dirname(output), {recursive: true});
  const parent = path.dirname(output), stage = fs.mkdtempSync(path.join(parent, '.mobilegym-release-stage-'));
  const staged = new Map();
  const cleanup = () => {
    if (!fs.existsSync(stage)) return;
    if (path.dirname(stage) !== parent || !path.basename(stage).startsWith('.mobilegym-release-stage-') || !samePath(fs.realpathSync(stage), stage)) throw Error('Refusing unsafe stage cleanup');
    // Only unlink our exact numbered hardlinks. Never recursively delete a tree.
    for (const slot of staged.values()) if (fs.existsSync(slot)) fs.unlinkSync(slot);
    fs.rmdirSync(stage);
  };
  try {
    for (const item of records.values()) {
      const {filename, stat} = regularFile(previous, item.name);
      if (stat.size !== item.bytes || await digestFile(filename) !== item.sha256) throw Error('Retained asset integrity mismatch: ' + item.name);
      const slot = path.join(stage, String(staged.size));
      try {fs.linkSync(filename, slot);} catch (error) {
        if (!['EXDEV', 'EPERM', 'ENOTSUP'].includes(error.code)) throw error;
        fs.copyFileSync(filename, slot, fs.constants.COPYFILE_EXCL);
      }
      staged.set(item.name, slot);
    }
  } catch (error) {cleanup(); throw error;}
  return {releases, records, staged, total, cleanup};
}

export async function finishRelease(output, freshNames, snapshot) {
  const current = await inventoryAssets(output, freshNames), currentRelease = {id: releaseId(current), assets: current};
  const currentNames = new Set(current.map(item => item.name));
  for (const item of snapshot.records.values()) {
    const destination = assetPath(output, item.name);
    if (fs.existsSync(destination)) {
      const {stat} = regularFile(output, item.name);
      if (stat.size !== item.bytes || await digestFile(destination) !== item.sha256) throw Error('Refusing to overwrite an asset collision: ' + item.name);
    } else {
      fs.mkdirSync(path.dirname(destination), {recursive: true});
      const slot = snapshot.staged.get(item.name);
      if (await digestFile(slot) !== item.sha256) throw Error('Snapshot changed while building: ' + item.name);
      try {fs.linkSync(slot, destination);} catch (error) {
        if (!['EXDEV', 'EPERM', 'ENOTSUP'].includes(error.code)) throw error;
        fs.copyFileSync(slot, destination, fs.constants.COPYFILE_EXCL);
      }
    }
  }
  const releases = [currentRelease, ...snapshot.releases.filter(item => item.id !== currentRelease.id)];
  fs.writeFileSync(path.join(output, INVENTORY), JSON.stringify({version: 1, releases}));
  return {current: current.length, retained: [...snapshot.records.keys()].filter(name => !currentNames.has(name)).length, releases: releases.length, retainedBytes: snapshot.total};
}

/** Applies to normal CLI and API builds; preview never mutates build files.
 * @returns {import('vite').Plugin}
 */
export function releaseAssetHistoryPlugin() {
  let config, snapshot, freshNames = [], lockFile, lockFd;
  const cleanup = () => {
    snapshot?.cleanup(); snapshot = undefined;
    if (lockFd !== undefined) {
      const owned = fs.fstatSync(lockFd), current = fs.existsSync(lockFile) ? fs.lstatSync(lockFile) : null;
      fs.closeSync(lockFd); lockFd = undefined;
      if (current && (owned.ino !== current.ino || owned.dev !== current.dev || current.isSymbolicLink())) throw Error('Release lock ownership changed; refusing removal');
      if (current) fs.unlinkSync(lockFile);
    }
  };
  return {
    name: 'mobilegym-release-asset-history',
    apply: 'build',
    configResolved(value) {config = value;},
    async buildStart() {
      const projectRoot = path.resolve(config.root), output = path.resolve(projectRoot, config.build.outDir), allowedRoot = path.dirname(projectRoot);
      requireContainedDirectory(output, allowedRoot);
      if (samePath(output, projectRoot) || isInside(projectRoot, output)
        || ['apps', 'os', 'system', 'public', 'scripts', 'tests', 'web', 'bench_env', 'node_modules', '.git'].some(name => samePath(output, path.join(projectRoot, name)) || isInside(output, path.join(projectRoot, name)))) throw Error('Refusing a source-directory release output');
      if (fs.existsSync(path.join(output, 'index.html')) && (config.build.emptyOutDir === false
        || !isInside(output, projectRoot) && config.build.emptyOutDir !== true)) throw Error('Existing release output must be clean-built; use --emptyOutDir or a new immutable output directory');
      const previous = process.env.MOBILEGYM_PREVIOUS_RELEASE ? path.resolve(config.root, process.env.MOBILEGYM_PREVIOUS_RELEASE) : output;
      lockFile = path.join(path.dirname(output), '.mobilegym-release-' + crypto.createHash('sha256').update(output).digest('hex').slice(0, 16) + '.lock');
      fs.mkdirSync(path.dirname(lockFile), {recursive: true});
      lockFd = fs.openSync(lockFile, 'wx');
      fs.writeFileSync(lockFd, JSON.stringify({pid: process.pid, output}));
      try {
        snapshot = await snapshotHistory({previous, output, allowedRoot,
          keep: Number(process.env.MOBILEGYM_RELEASE_HISTORY_LIMIT ?? 8),
          maxBytes: Number(process.env.MOBILEGYM_RELEASE_HISTORY_MAX_BYTES ?? 512 * 1024 * 1024),
          trustLegacy: !!process.env.MOBILEGYM_PREVIOUS_RELEASE && process.env.MOBILEGYM_TRUST_LEGACY_ASSETS === '1'});
      } catch (error) {cleanup(); throw error;}
    },
    generateBundle: {order: 'pre', handler(_options, bundle) {freshNames = Object.keys(bundle).filter(name => ASSET.test(name));}},
    writeBundle: {order: 'post', async handler(_options, bundle) {
      try {const result = await finishRelease(path.resolve(config.root, config.build.outDir), [...freshNames, ...Object.keys(bundle).filter(name => ASSET.test(name))], snapshot); config.logger.info('[release-assets] ' + JSON.stringify(result));}
      finally {cleanup();}
    }},
    buildEnd(error) {if (error) cleanup();},
    closeBundle() {cleanup();},
  };
}

/** Missing assets must be actual 404s, never a successful SPA HTML response.
 * @returns {import('vite').Plugin}
 */
export function releaseAssetResponsePlugin() {
  return {
    name: 'mobilegym-release-asset-responses',
    configurePreviewServer(server) {
      const output = path.resolve(server.config.root, server.config.build.outDir);
      const prefix = new URL(server.config.base, 'http://preview.invalid').pathname.replace(/\/$/, '') + '/assets/';
      server.middlewares.use((request, response, next) => {
        const raw = (request.url ?? '').split('?')[0];
        if (!raw.startsWith(prefix)) {next(); return;}
        response.setHeader('X-Content-Type-Options', 'nosniff');
        const reject = status => {response.statusCode = status; response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.setHeader('Cache-Control', 'no-store'); response.end(request.method === 'HEAD' ? undefined : 'Missing release asset');};
        if (!['GET', 'HEAD'].includes(request.method ?? '')) {reject(405); return;}
        let name;
        try {name = 'assets/' + decodeURIComponent(raw.slice(prefix.length));} catch {reject(400); return;}
        const filename = path.resolve(output, name);
        if (name.includes('\\') || name.includes('\0') || !isInside(filename, path.join(output, 'assets'))) {reject(404); return;}
        try {
          const stat = fs.lstatSync(filename);
          if (!stat.isFile() || stat.isSymbolicLink() || !samePath(fs.realpathSync(filename), filename)) {reject(404); return;}
        } catch {reject(404); return;}
        if (ASSET.test(name)) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        next(); // Vite owns MIME, ranges, compression and file delivery.
      });
    },
  };
}
