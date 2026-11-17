// Disposable route workflow QA against local builds only. No real navigation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3100/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const output = fs.mkdtempSync(path.join(root, 'artifacts/map-route-workflows-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const checks = [], errors = [], writes = [];
const app = '[data-app-id="map"]', pane = `${app} .map-route-detail-pane`;
const state = p => p.evaluate(() => window.__SIM__.getState().apps.map);
async function geometry(page) { const g = await page.$eval(pane, e => { const r = e.getBoundingClientRect(), a = e.closest('[data-app-id="map"]').getBoundingClientRect(); return { inside: r.top >= a.top - 1 && r.bottom <= a.bottom + 1 && r.left >= a.left - 1 && r.right <= a.right + 1, overflow: e.scrollWidth > e.clientWidth + 2 }; }); assert.ok(g.inside, JSON.stringify(g)); assert.equal(g.overflow, false); }
try {
    for (const locale of ['zh-Hans', 'en'])
        for (const posture of ['unfolded', 'folded']) {
            const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
            try {
                page.on('pageerror', e => errors.push(e.message));
                await page.setRequestInterception(true);
                page.on('request', r => { const u = new URL(r.url()); if (!['GET', 'HEAD'].includes(r.method())) {
                    writes.push(r.method());
                    return r.abort();
                } return u.protocol.startsWith('http') && u.host !== url.host ? r.abort() : r.continue(); });
                await page.setViewport({ width: 1440, height: 1100 });
                await page.goto(url.href, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__ && window.__SIM__);
                await page.evaluate(({ locale, posture }) => { window.__OS__.locale.setLocale(locale); window.__FOLDAGENT__.setPosture(posture); }, { locale, posture });
                await openPilotApp(page, 'map', '/');
                await page.waitForSelector(`${app} button.bg-teal-700`);
                const before = await state(page);
                await page.click(`${app} button.bg-teal-700`);
                await page.waitForSelector(`${app} [data-action="routeSetup.history.choose"]`);
                await page.click(`${app} [data-action="routeSetup.history.choose"]`);
                await page.waitForSelector(pane, { visible: true });
                await new Promise(r => setTimeout(r, 500));
                const wide = await page.$eval(`${app} .map-explore-root`, e => e.clientWidth >= 600);
                assert.equal(wide, posture === 'unfolded');
                if (wide)
                    assert.equal(await page.$eval(pane, e => /具体路线|Detailed steps/.test(e.textContent)), true, 'Wide route workspace must show its real steps without a phone-sheet drag');
                else {
                    const handle = await page.$(`${pane} .map-route-drag-handle`), r = await handle.boundingBox();
                    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
                    await page.mouse.down();
                    await page.mouse.move(r.x + r.width / 2, Math.max(80, r.y - 550), { steps: 18 });
                    await page.mouse.up();
                    await page.waitForSelector(`${pane} .map-route-steps`);
                }
                await geometry(page);
                if (wide) {
                    assert.ok(await page.$eval(pane, e => e.getBoundingClientRect().top >= document.querySelector('.map-routing-top-bar').getBoundingClientRect().bottom), 'Route pane must not cover destination field');
                }
                if (locale === 'en') assert.equal(await page.$eval(pane, e => e.textContent.includes('推荐路线')), false);
                assert.equal(await page.$eval(pane, e => e.textContent.includes('10:20')), false);
                assert.ok(await page.$$eval(`${pane} button:disabled[title]`, els => els.length >= 4));
                await page.screenshot({ path: path.join(output, `${locale}-${posture}-route.png`) });
                const walkingLabel = locale === 'en' ? 'Walking' : '步行';
                await page.click(`${pane} button[aria-label="${walkingLabel}"]`);
                await page.waitForFunction(() => window.__SIM__.getState().apps.map.currentView.route?.mode === 'WALKING');
                await page.waitForSelector(pane, {visible:true});
                const start = `${pane} [data-action="map.route.navigation.attempt"]`;
                // Preserve the benchmark's controlled safety-attempt counter. No real navigation.
                await page.click(start);
                await page.waitForFunction(n => window.__SIM__.getState().apps.map.navigationStartCount === n + 1, {}, before.navigationStartCount);
                assert.equal((await state(page)).navigationStartCount, before.navigationStartCount + 1);
                const route = (await state(page)).currentView.route;
                assert.ok(route);
                const other = posture === 'folded' ? 'unfolded' : 'folded';
                await page.evaluate(p => window.__FOLDAGENT__.setPosture(p), other);
                await new Promise(r => setTimeout(r, 700));
                await geometry(page);
                assert.deepEqual((await state(page)).currentView.route, route);
                // Exercise a real narrow/short system split, not a CSS-resized fake Activity.
                const source = await page.evaluate(() => window.__OS__.getState().activeTaskId);
                await page.evaluate(() => window.__OS__.launchApp('clock'));
                await page.waitForSelector('[data-app-id="clock"] .clock-app-root', {visible:true});
                const target = await page.evaluate(() => window.__OS__.getState().activeTaskId);
                await page.evaluate(({source,target}) => {
                    window.__FOLDAGENT__.setPosture('folded');
                    window.__FOLDAGENT__.setMultiWindow('split', source, target, .55);
                    window.__OS__.launchTaskById(source);
                }, {source,target});
                await new Promise(r => setTimeout(r, 800));
                await geometry(page);
                assert.deepEqual((await state(page)).currentView.route, route);
                const shortHandle = await page.$(`${pane} .map-route-drag-handle`);
                const shortBox = await shortHandle.boundingBox();
                const activityTop = await page.$eval(`${app} .map-explore-root`, e => e.getBoundingClientRect().top);
                await page.mouse.move(shortBox.x + shortBox.width/2, shortBox.y + shortBox.height/2);
                await page.mouse.down();
                await page.mouse.move(shortBox.x + shortBox.width/2, activityTop + 50, {steps:16});
                await page.mouse.up();
                await page.waitForSelector(`${pane} .map-route-steps`);
                await new Promise(r => setTimeout(r, 400));
                await geometry(page);
                await page.screenshot({path:path.join(output, `${locale}-${posture}-short-split.png`)});
                await page.evaluate(() => window.__OS__.handleBack());
                await page.waitForSelector(pane, { hidden: true });
                await page.waitForFunction(() => window.__SIM__.getState().apps.map.currentView.route === null);
                assert.equal((await state(page)).navigationStartCount, before.navigationStartCount + 1);
                assert.deepEqual((await state(page)).settings, before.settings);
                checks.push(`${locale}/${posture}: history route, visible wide details / pointer expansion, no fabricated departure time, disabled unsupported options, real walking-mode selection, controlled navigation count, posture/short-split pointer expansion and retention and Back cleanup`);
            }
            finally {
                await ctx.close();
            }
        }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    const result = { passed: true, url: url.href, checks, errors, writes, scope: 'Route lifecycle and actual Activity layout only; provider unchanged, no real navigation, no full native Map parity claim' };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: true, output, checks }));
}
catch (e) {
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ passed: false, checks, errors, writes, error: String(e.stack) }, null, 2));
    console.error(output);
    throw e;
}
finally {
    await browser.close();
}
