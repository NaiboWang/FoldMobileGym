import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root = path.resolve(import.meta.dirname, '../..'), require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3191/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
const output = fs.mkdtempSync(path.join(root, 'artifacts/file-search-identity-'));
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const checks = [], failures = [], errors = [], writes = [], observations = [];
const app = '[data-app-id="file_manager"]', name = 'Report[1].txt';
const base = '/sdcard/file-search-review/' + '同名文件归档目录'.repeat(7);
const records = p => p.evaluate(() => {
  const rows = [], walk = dir => {
    for (const { thumbnailUri, ...node } of window.__SIM_FS__.list(dir)) {
      rows.push(node); if (node.type === 'directory') walk(node.path);
    }
  };
  walk('/sdcard'); return rows.sort((a, b) => a.path.localeCompare(b.path));
});
const contents = p => p.evaluate(async ({ base, name }) => {
  const values = [];
  for (const dir of ['原始资料', '副本资料']) {
    const raw = await window.__SIM_FS__.read(`${base}/${dir}/${name}`);
    values.push(Array.from(new Uint8Array(await new Blob([raw]).arrayBuffer())));
  }
  return values;
}, { base, name });
try {
  for (const posture of ['folded', 'unfolded']) for (const locale of ['zh-Hans', 'en']) {
    const context = await browser.createBrowserContext(), p = await context.newPage(), label = `${posture}-${locale}`;
    p.on('pageerror', e => errors.push({ label, error: e.message }));
    await p.setRequestInterception(true);
    p.on('request', r => {
      const u = new URL(r.url());
      if (!['GET', 'HEAD'].includes(r.method())) { writes.push(r.method()); return r.abort(); }
      if ((u.protocol.startsWith('http') && u.host !== url.host) || u.pathname.startsWith('/api/gw/')) return r.abort();
      return r.continue();
    });
    try {
      await p.setViewport({ width: 1440, height: 1100 }); await p.goto(url.href, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => window.__OS__ && window.__SIM_FS__ && window.__FOLDAGENT__);
      await p.evaluate(async ({ posture, locale, base, name }) => {
        window.__FOLDAGENT__.setPosture(posture); window.__OS__.locale.setLocale(locale);
        for (const dir of ['原始资料', '副本资料']) await window.__SIM_FS__.write(`${base}/${dir}/${name}`, dir, { mimeType: 'text/plain' });
      }, { posture, locale, base, name });
      const before = await records(p), beforeBytes = await contents(p);
      await openPilotApp(p, 'file_manager', '/search?q=' + encodeURIComponent(' [1] '));
      await p.waitForSelector(`${app} .fm-search-result`, { visible: true });
      const rows = await p.$$eval(`${app} .fm-search-result`, els => els.map(e => ({
        name: e.querySelector('strong').textContent,
        marks: [...e.querySelectorAll('strong mark')].map(m => m.textContent),
        path: e.querySelector('.fm-search-copy small').textContent,
        pathClipped: e.querySelector('.fm-search-copy small').scrollWidth > e.querySelector('.fm-search-copy small').clientWidth + 1,
      })));
      observations.push({ label, rows });
      assert.equal(rows.length, 2); for (const row of rows) { assert.equal(row.name, name); assert.deepEqual(row.marks, ['[1]']); assert.equal(row.pathClipped, false, 'Complete directory identity must not be ellipsized'); }
      assert.deepEqual(rows.map(r => r.path).sort(), [`${base}/原始资料/${name}`, `${base}/副本资料/${name}`].sort());
      await p.screenshot({ path: path.join(output, `${label}.jpg`) });
      const target = `${base}/原始资料/${name}`;
      const point = await p.$$eval(`${app} .fm-search-result`, (els, target) => {
        const e = els.find(e => e.textContent.includes(target)); e.scrollIntoView({ block: 'center' });
        const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, target);
      await p.mouse.click(point.x, point.y);
      await p.waitForFunction(target => decodeURIComponent(window.__OS__.getAppRoute('file_manager').path).includes(target), {}, target);
      await p.evaluate(() => window.__OS__.handleBack());
      await p.waitForSelector(`${app} .fm-search-result`, { visible: true });
      const after = await records(p);
      assert.deepEqual(after, before, 'Browsing and highlighting must not mutate files');
      assert.deepEqual(await contents(p), beforeBytes, 'Both same-name source payloads must retain all bytes');
      checks.push({ label, rows });
    } catch (e) { failures.push({ label, error: String(e) }); await p.screenshot({ path: path.join(output, `${label}-failure.jpg`) }).catch(() => {}); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
const result = { passed: !failures.length && !errors.length && !writes.length, checks, failures, errors, writes, observations, output };
fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
