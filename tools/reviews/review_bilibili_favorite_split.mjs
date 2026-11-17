import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '../..'), front = fs.existsSync(path.join(root, 'mobilegym/package.json')) ? 'mobilegym' : 'foldmobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const { openPilotApp: open } = await import(pathToFileURL(path.join(root, front === 'mobilegym' ? 'foldmobilegym/tools/pilot_app_navigation.mjs' : 'tools/browser-automation/pilot_app_navigation.mjs')));
const { setBilibiliReviewLocale } = await import(pathToFileURL(path.join(root, front, 'scripts/bilibili_review_locale.mjs')));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3286/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const baseline = process.env.FOLDAGENT_REVIEW_BASELINE === '1';
const selectedCase = process.env.FOLDAGENT_REVIEW_CASE || null;
const videoId = JSON.parse(fs.readFileSync(path.join(root, front, 'apps/Bilibili/data/videos.json'), 'utf8')).find(video => video.id && video.title).id;
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
assert.ok(executablePath);
const browser = await require('puppeteer').launch({ headless: true, executablePath }), checks = [];
const app = '[data-app-id="bilibili"]', sheet = `${app} [data-bili-fav-sheet]`, panel = `${sheet} [data-bili-fav-panel]`, done = `${sheet} [data-bili-fav-done]`;
const favorite = `${app} [data-action="video.intro.fav.toggle"]`;
const folders = page => page.evaluate(() => window.__SIM__.getState().apps.bilibili.user.favoritesFolders);
async function hit(page, selector) {
  await page.$eval(selector, node => node.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(async selector => {
    const node = document.querySelector(selector); if (!node?.checkVisibility()) return false;
    const a = node.getBoundingClientRect(); await new Promise(resolve => requestAnimationFrame(resolve));
    const b = node.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const stable = Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5;
    if (stable && (top === node || node.contains(top))) return true;
    // A pane/header rebase can finish after the first scrollIntoView. Retry
    // real scrolling only when there is a nonzero scrollable viewport; keep
    // requiring the same physical hit target instead of clicking through it.
    if (stable) {
      let parent = node.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.clientHeight > 0 && parent.scrollHeight > parent.clientHeight) { node.scrollIntoView({ block: 'center' }); break; }
        parent = parent.parentElement;
      }
    }
    return false;
  }, {}, selector);
}
async function show(page) { await hit(page, favorite); await page.hover(favorite); await page.mouse.down(); await new Promise(resolve => setTimeout(resolve, 900)); await page.mouse.up(); await page.waitForSelector(sheet, { visible: true }); }
async function settled(page) {
  await page.waitForFunction(selector => {
    const p = document.querySelector(selector), host = p?.parentElement; if (!p || !host) return false;
    return Math.abs(Number(p.dataset.biliFavHeight) - parseFloat(getComputedStyle(host).height)) < 1
      && Math.abs(parseFloat(p.style.top) - parseFloat(getComputedStyle(p).top)) < .5 && p.dataset.biliFavDragging === 'false';
  }, {}, panel);
}
async function geometry(page) {
  return page.$eval(sheet, e => {
    const host = e.getBoundingClientRect(), parent = e.closest('[data-app-id]').getBoundingClientRect();
    const p = (e.querySelector('[data-bili-fav-panel]') || e.children[1]).getBoundingClientRect(), d = e.querySelector('[data-bili-fav-done]').getBoundingClientRect();
    return { host: host.toJSON(), panel: p.toJSON(), done: d.toJSON(), within: p.height > 0 && p.top >= host.top - 1 && p.bottom <= host.bottom + 1 && d.top >= host.top - 1 && d.bottom <= host.bottom + 1 && host.top >= parent.top - 1 && host.bottom <= parent.bottom + 1 };
  });
}
try {
 for (const viewport of baseline ? [{ width: 1440, height: 1100 }] : [{ width: 1440, height: 1100 }, { width: 1000, height: 700 }, { width: 430, height: 932 }]) for (const locale of baseline ? ['en'] : ['zh-Hans', 'en']) {
  if (selectedCase && selectedCase !== `${viewport.width}x${viewport.height}-${locale}`) continue;
  const context = await browser.createBrowserContext(), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message)); await page.setRequestInterception(true);
  page.on('request', request => { const u = new URL(request.url()); if (request.method() === 'GET' && (u.origin === url.origin && !/^\/api(?:\/|$)/.test(u.pathname) || ['data:', 'blob:'].includes(u.protocol))) request.continue(); else request.abort(); });
  try {
   await page.setViewport(viewport); await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
   await page.evaluate(() => window.__FOLDAGENT__.setPosture('unfolded')); await setBilibiliReviewLocale(page, locale, open);
   await page.evaluate(id => { const s = window.__SIM__.getState().apps.bilibili; window.__SIM__.setState({ apps: { bilibili: { user: { ...s.user, favoritesFolders: [{ id: 'geometry-kept', title: 'Local kept', videoIds: [id] }, { id: 'geometry-other', title: 'Local other', videoIds: [] }] } } } }, { deep: true, reload: false }); }, videoId);
   await open(page, 'bilibili', `/video/${encodeURIComponent(videoId)}?tab=intro`); await open(page, 'clock', '/alarm');
   const ids = await page.evaluate(() => { const tasks = window.__OS__.getState().tasks; return { b: tasks.find(t => t.rootAppId === 'bilibili').taskId, c: tasks.find(t => t.rootAppId === 'clock').taskId }; });
   await page.evaluate(id => window.__OS__.launchTaskById(id), ids.b); await show(page);
   if (baseline) {
    await page.evaluate(({ b, c }) => { window.__FOLDAGENT__.setMultiWindow('split', b, c, .5); window.__FOLDAGENT__.setPosture('folded'); }, ids);
    await new Promise(resolve => setTimeout(resolve, 450)); const old = await geometry(page); assert.equal(old.within, false);
    checks.push({ baseline: true, outsidePane: true }); console.log('BASELINE: folding split leaves sheet outside its Activity'); continue;
   }
   await settled(page); assert.equal((await geometry(page)).within, true);
   const original = await folders(page); await page.click(`${sheet} [data-bili-fav-folder="geometry-other"]`);
   for (const [posture, ratio] of [['unfolded', .5], ['folded', .5], ['folded', .35], ['folded', .65], ['unfolded', .5]]) {
    await page.evaluate(({ ids, posture, ratio }) => { window.__FOLDAGENT__.setMultiWindow('split', ids.b, ids.c, ratio); window.__FOLDAGENT__.setPosture(posture); }, { ids, posture, ratio });
    await settled(page); const result = await geometry(page); assert.equal(result.within, true, JSON.stringify({ viewport, posture, ratio, result }));
    assert.equal(await page.$eval(`${sheet} [data-bili-fav-folder="geometry-other"]`, node => node.getAttribute('aria-checked')), 'true'); assert.deepEqual(await folders(page), original);
   }
   const grab = await page.$(`${sheet} [data-bili-fav-handle]`), point = await grab.boundingBox(), before = await geometry(page);
   await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2); await page.mouse.down(); await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2 + 40, { steps: 5 });
   const moved = await geometry(page); assert.ok(Math.abs(moved.panel.top - before.panel.top - 40) < 2, 'scaled pointer movement must use Activity coordinates');
   await page.$eval(panel, node => node.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }))); await page.mouse.up(); await settled(page);
   assert.equal((await geometry(page)).within, true); assert.deepEqual(await folders(page), original);
   const again = await (await page.$(`${sheet} [data-bili-fav-handle]`)).boundingBox();
   await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2); await page.mouse.down(); await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2 - 15, { steps: 3 });
   await page.evaluate(() => window.__FOLDAGENT__.setPosture('folded'));
   await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('data-bili-fav-dragging') === 'false', {}, panel);
   await page.mouse.up(); await settled(page); assert.equal((await geometry(page)).within, true); assert.deepEqual(await folders(page), original);
   await hit(page, done); await page.click(done); await page.waitForSelector(sheet, { hidden: true });
   assert.ok((await folders(page)).find(folder => folder.id === 'geometry-other').videoIds.includes(videoId));
   const saved = await folders(page);
   await page.evaluate(({ b, c }) => { window.__FOLDAGENT__.setMultiWindow('split', b, c, .35); window.__FOLDAGENT__.setPosture('folded'); }, ids);
   await show(page); await settled(page); assert.equal((await geometry(page)).within, true);
   await hit(page, done); await page.click(done); await page.waitForSelector(sheet, { hidden: true }); assert.deepEqual(await folders(page), saved);
   assert.deepEqual(errors, []); checks.push({ viewport, locale, splitFold: true, shortPane: true, scale: true, cancelledDrag: true, foldedDuringDrag: true, directFoldedOpen: true, selectionRetained: true, saved: true }); console.log('PASS', viewport.width, viewport.height, locale);
  } catch (error) {
    const diagnostic = await page.$eval(favorite, node => {
      const r = node.getBoundingClientRect(), root = node.closest('[data-app-id]').getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const scroll = []; let parent = node.parentElement;
      while (parent) { const style = getComputedStyle(parent); if (style.overflowY === 'auto' || style.overflowY === 'scroll') scroll.push({ name: parent.dataset.scrollContainer, top: parent.scrollTop, height: parent.clientHeight, total: parent.scrollHeight, rect: parent.getBoundingClientRect().toJSON() }); parent = parent.parentElement; }
      return { target: r.toJSON(), root: root.toJSON(), hit: top?.tagName, hitApp: top?.closest('[data-app-id]')?.getAttribute('data-app-id'), scroll };
    }).catch(() => null);
    console.error(JSON.stringify({ viewport, locale, diagnostic })); throw error;
  } finally { await context.close(); }
 }
} finally { await browser.close(); }
assert.ok(checks.length > 0, 'No matching review case');
console.log(JSON.stringify({ passed: true, baseline, selectedCase, checks }));
