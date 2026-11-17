// Only disposable local simulator data is changed, in isolated browser contexts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });


const root = path.resolve(import.meta.dirname, '../..');
const frontend = fs.existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, frontend, 'package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3313/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/gallery-mutations-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const app = '[data-app-id="gallery"]';
const checks = [], failures = [], errors = [], writes = [];
const route = p => p.evaluate(() => window.__OS__.getAppRoute('gallery').path);
const favorites = p => p.evaluate(() => window.__OS__.content.query('content://media/favorites').items.map(i => i.path).sort());
const files = p => p.evaluate(() => window.__SIM_FS__.getMedia().map(n => n.path).sort());
async function hit(p, selector) {
  await p.waitForFunction(async s => {
    const e = [...document.querySelectorAll(s)].find(e => e.checkVisibility());
    if (!e || e.disabled) return false;
    const a = e.getBoundingClientRect(); await new Promise(r => requestAnimationFrame(r));
    const b = e.getBoundingClientRect(), t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && (e === t || e.contains(t));
  }, {}, selector);
  const handles = await p.$$(selector);
  try { for (const h of handles) if (await h.evaluate(e => e.checkVisibility())) { await h.click(); return; } }
  finally { for (const h of handles) await h.dispose(); }
  throw Error(`Missing visible control: ${selector}`);
}
async function start(p, locale, posture, target = '/') {
  await p.setViewport({ width: 1440, height: 1100 });
  await p.goto(url.href, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__ && window.__SIM_FS__);
  await p.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
  await openPilotApp(p, 'gallery', target);
}
async function select(p, album = false) {
  await hit(p, `${app} [data-trigger="${album ? 'gallery.album.select.open' : 'gallery.photos.select.open'}"]`);
  await p.waitForFunction(() => window.__OS__.getAppRoute('gallery').path.includes('selection=on'));
  const paths = await p.$$eval(`${app} .gallery-photo-tile`, es => es.filter(e => e.checkVisibility()).slice(0, 2).map(e => e.dataset.gallerySourceId));
  assert.equal(paths.length, 2);
  for (const mediaPath of paths) {
    const selector = await p.evaluate(({ app, mediaPath }) => `${app} [data-gallery-source-id="${CSS.escape(mediaPath)}"]`, { app, mediaPath });
    await hit(p, selector);
  }
  await p.waitForFunction(() => [...document.querySelectorAll('[data-gallery-selection-count]')].some(e => e.checkVisibility() && e.dataset.gallerySelectionCount === '2'));
  return paths;
}
async function rewrite(p, mediaPath) {
  await p.evaluate(async mediaPath => {
    const api = window.__SIM_FS__, node = api.stat(mediaPath), bytes = await api.read(mediaPath);
    if (!bytes || !node) throw Error('Cannot prepare controlled source replacement');
    await api.write(mediaPath, bytes, { mimeType: node.mimeType });
  }, mediaPath);
}
async function run(name, fn) {
  const context = await browser.createBrowserContext(), p = await context.newPage();
  p.on('pageerror', error => errors.push({ name, error: String(error) }));
  p.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push({ name, url: request.url(), method: request.method() }); });
  try { await fn(p); checks.push(name); console.log(`PASS ${name}`); }
  catch (error) {
    const state = await p.evaluate(() => ({ route: window.__OS__?.getAppRoute('gallery')?.path, active: window.__OS__?.getState().activeAppId,
      favorites: window.__OS__?.content.query('content://media/favorites').items,
      selection: [...document.querySelectorAll('[data-gallery-selection-count]')].map(e => ({ count: e.dataset.gallerySelectionCount, visible: e.checkVisibility() })) })).catch(() => null);
    failures.push({ name, error: String(error.stack), state }); console.error(`FAIL ${name}: ${error.stack} ${JSON.stringify(state)}`);
    await p.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {});
  }
  finally { await context.close(); }
}
const selectFavorite = `${app} [data-action="gallery.select.favorite.submit"]`;
const deleteOpen = `${app} [data-trigger="gallery.select.delete.open"]`;
const deleteSubmit = `${app} [data-action="gallery.select.delete.submit"]`;
try {
  for (const locale of ['zh-Hans', 'en']) for (const posture of ['folded', 'unfolded']) {
    const tag = `${locale}-${posture}`;
    await run(`${tag}-favorite-continuity`, async p => {
      await start(p, locale, posture); const before = await files(p), paths = await select(p);
      await p.evaluate(other => window.__FOLDAGENT__.setPosture(other), posture === 'folded' ? 'unfolded' : 'folded');
      await p.waitForFunction(() => [...document.querySelectorAll('[data-gallery-selection-count]')].some(e => e.checkVisibility() && e.dataset.gallerySelectionCount === '2'));
      await hit(p, selectFavorite);
      await p.waitForFunction(() => !window.__OS__.getAppRoute('gallery').path.includes('selection=on'));
      assert.deepEqual(await favorites(p), [...paths].sort()); assert.deepEqual(await files(p), before);
    });
    await run(`${tag}-background-favorite`, async p => {
      await start(p, locale, posture); await select(p);
      const before = await favorites(p), galleryRoute = await route(p), retained = await p.$(selectFavorite);
      await openPilotApp(p, 'clock', '/world'); await retained.evaluate(e => e.click());
      assert.deepEqual(await favorites(p), before); assert.equal(await route(p), galleryRoute); await retained.dispose();
    });
    await run(`${tag}-changed-batch-is-inert`, async p => {
      await start(p, locale, posture); const paths = await select(p), before = await files(p);
      await rewrite(p, paths[1]); await hit(p, selectFavorite);
      await p.waitForSelector(`${app} [data-gallery-share-feedback] > div`, { visible: true });
      assert.deepEqual(await favorites(p), []); assert.deepEqual(await files(p), before);
      await hit(p, deleteOpen); assert.equal((await route(p)).includes('modal=delete'), false);
    });
    await run(`${tag}-delete-confirm-cancel-and-source`, async p => {
      await start(p, locale, posture); const paths = await select(p), before = await files(p);
      await hit(p, deleteOpen); await p.waitForSelector(deleteSubmit, { visible: true });
      await p.evaluate(() => window.__OS__.handleBack());
      await p.waitForFunction(() => !window.__OS__.getAppRoute('gallery').path.includes('modal=delete'));
      assert.deepEqual(await files(p), before);
      await hit(p, deleteOpen); await p.waitForSelector(deleteSubmit, { visible: true });
      await rewrite(p, paths[1]); await hit(p, deleteSubmit);
      await p.waitForSelector(`${app} [data-gallery-mutation-feedback]`, { visible: true });
      assert.deepEqual(await files(p), before); assert.equal((await route(p)).includes('modal=delete'), true);
      await p.screenshot({ path: path.join(output, `${tag}-source-change-confirmation.png`) });
    });
    await run(`${tag}-delete-normal`, async p => {
      await start(p, locale, posture); const before = await files(p), paths = await select(p);
      await hit(p, deleteOpen); await hit(p, deleteSubmit);
      await p.waitForFunction(() => !window.__OS__.getAppRoute('gallery').path.includes('selection=on'));
      assert.deepEqual(await files(p), before.filter(path => !paths.includes(path)));
      assert.equal(await p.$(`${app} [role="dialog"]`), null);
    });
    await run(`${tag}-viewer-delete-url-and-back`, async p => {
      await start(p, locale, posture); const before = await files(p);
      const selected = await p.$eval(`${app} [data-trigger="photo.open"]`, e => decodeURIComponent(JSON.parse(e.dataset.triggerParams).path));
      await hit(p, `${app} [data-trigger="photo.open"]`);
      await hit(p, `${app} [data-trigger="photo.modal.delete.open"]`);
      await hit(p, `${app} [data-action="gallery.viewer.delete.submit"]`);
      await p.waitForFunction(selected => { const r = window.__OS__.getAppRoute('gallery').path; return r.startsWith('/photo/') && !r.includes('modal=') && !r.includes(encodeURIComponent(selected)); }, {}, selected);
      const nextPath = decodeURIComponent((await route(p)).split('?')[0].slice('/photo/'.length));
      await p.waitForFunction(nextPath => { const e = document.querySelector('[data-app-id="gallery"] .gallery-viewer-image'); return e?.complete && e.naturalWidth > 0 && e.alt === nextPath.split('/').at(-1); }, {}, nextPath);
      assert.deepEqual(await files(p), before.filter(path => path !== selected));
      await p.evaluate(() => window.__OS__.handleBack());
      await p.waitForFunction(() => window.__OS__.getAppRoute('gallery').path === '/');
    });
    await run(`${tag}-viewer-background-delete`, async p => {
      await start(p, locale, posture); const before = await files(p);
      await hit(p, `${app} [data-trigger="photo.open"]`);
      await hit(p, `${app} [data-trigger="photo.modal.delete.open"]`);
      const selector = `${app} [data-action="gallery.viewer.delete.submit"]`;
      await p.waitForSelector(selector, { visible: true });
      const retained = await p.$(selector), galleryRoute = await route(p);
      await openPilotApp(p, 'clock', '/world'); await retained.evaluate(e => e.click());
      assert.deepEqual(await files(p), before); assert.equal(await route(p), galleryRoute); await retained.dispose();
    });
    await run(`${tag}-viewer-source-change`, async p => {
      await start(p, locale, posture); const before = await files(p);
      const selected = await p.$eval(`${app} [data-trigger="photo.open"]`, e => decodeURIComponent(JSON.parse(e.dataset.triggerParams).path));
      await hit(p, `${app} [data-trigger="photo.open"]`);
      await hit(p, `${app} [data-trigger="photo.modal.delete.open"]`);
      await p.waitForSelector(`${app} [data-action="gallery.viewer.delete.submit"]`, { visible: true });
      await rewrite(p, selected); await hit(p, `${app} [data-action="gallery.viewer.delete.submit"]`);
      await p.waitForSelector(`${app} [data-gallery-mutation-feedback]`, { visible: true });
      assert.deepEqual(await files(p), before); assert.equal((await route(p)).includes('modal=delete'), true);
    });
  }
  for (const album of [false, true]) await run(`${album ? 'album' : 'timeline'}-background-delete-and-favorite`, async p => {
    await start(p, 'zh-Hans', 'unfolded');
    if (album) { await hit(p, `${app} [data-trigger="gallery.directory.albums.open"]`); await hit(p, `${app} [data-trigger="album.open"]`); }
    const paths = await select(p, album); const before = await files(p), beforeFavorites = await favorites(p);
    const selector = album ? `${app} [data-action="gallery.album.select.favorite.submit"]` : deleteOpen;
    if (!album) { await hit(p, deleteOpen); await p.waitForSelector(deleteSubmit, { visible: true }); }
    const retained = await p.$(album ? selector : deleteSubmit), galleryRoute = await route(p);
    await openPilotApp(p, 'clock', '/world'); await retained.evaluate(e => e.click());
    assert.deepEqual(await files(p), before); assert.deepEqual(await favorites(p), beforeFavorites); assert.equal(await route(p), galleryRoute); await retained.dispose();
    assert.equal(paths.length, 2);
  });
  await run('timeline-same-frame-selection-invalidates-submit', async p => {
    await start(p, 'zh-Hans', 'unfolded'); await select(p);
    const before = await favorites(p);
    await p.evaluate(() => {
      const root = document.querySelector('[data-app-id="gallery"]');
      const oldSubmit = root.querySelector('[data-action="gallery.select.favorite.submit"]');
      root.querySelector('.gallery-photo-tile').click();
      oldSubmit.click();
    });
    assert.deepEqual(await favorites(p), before);
    await p.waitForFunction(() => [...document.querySelectorAll('[data-gallery-selection-count]')].some(e => e.checkVisibility() && e.dataset.gallerySelectionCount === '1'));
  });
  for (const changed of [false, true]) await run(`album-favorite-${changed ? 'changed-source' : 'normal'}`, async p => {
    await start(p, 'en', 'unfolded');
    await hit(p, `${app} [data-trigger="gallery.directory.albums.open"]`); await hit(p, `${app} [data-trigger="album.open"]`);
    const selected = await select(p, true);
    if (changed) await rewrite(p, selected[1]);
    await hit(p, `${app} [data-action="gallery.album.select.favorite.submit"]`);
    if (changed) {
      await p.waitForSelector(`${app} [data-gallery-share-feedback] > div`, { visible: true });
      assert.deepEqual(await favorites(p), []); assert.equal((await route(p)).includes('selection=on'), true);
    } else {
      await p.waitForFunction(() => !window.__OS__.getAppRoute('gallery').path.includes('selection=on'));
      assert.deepEqual(await favorites(p), [...selected].sort());
    }
  });
  await run('intent-view-delete-sibling-and-return-to-caller', async p => {
    await start(p, 'en', 'unfolded');
    const paths = await p.evaluate(async () => {
      const api = window.__SIM_FS__, source = api.getMedia('image').find(n => n.mimeType === 'image/jpeg');
      const bytes = await api.read(source.path); if (!bytes) throw Error('Missing controlled image bytes');
      const dir = '/sdcard/Pictures/GalleryMutationReview'; await api.mkdir(dir);
      const paths = [`${dir}/first.jpg`, `${dir}/second.jpg`];
      for (const pathname of paths) await api.write(pathname, bytes, { mimeType: 'image/jpeg' });
      return paths;
    });
    await openPilotApp(p, 'clock', '/world');
    assert.equal(await p.evaluate(stream => window.__OS__.startActivity({ action: 'ACTION_VIEW', type: 'image/jpeg', data: { stream } }, { newTask: true }), paths[0]), true);
    await hit(p, `${app} [data-trigger="photo.intent.modal.delete.open"]`);
    await hit(p, `${app} [data-action="gallery.intent.delete.submit"]`);
    await p.waitForFunction(next => [...document.querySelectorAll('[data-app-id="gallery"] .gallery-viewer-image')].some(e => e.checkVisibility() && e.complete && e.naturalWidth > 0 && e.alt === next), {}, 'second.jpg');
    assert.equal(await p.evaluate(pathname => window.__SIM_FS__.exists(pathname), paths[0]), false);
    await hit(p, `${app} [data-trigger="photo.intent.modal.delete.open"]`);
    await hit(p, `${app} [data-action="gallery.intent.delete.submit"]`);
    await p.waitForFunction(() => window.__OS__.getState().activeAppId === 'clock');
    assert.equal(await p.evaluate(pathname => window.__SIM_FS__.exists(pathname), paths[1]), false);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: !failures.length && !errors.length && !writes.length, url: url.href, checks, failures, errors, writes,
    scope: 'Gallery local mutations, source versions, foreground ownership, posture continuity and URL Back; not native-pixel, all-Gallery or whole-web certification' }, null, 2));
}
console.log(JSON.stringify({ output, checks, failures, errors, writes }, null, 2));
assert.deepEqual(failures, []); assert.deepEqual(errors, []); assert.deepEqual(writes, []);
