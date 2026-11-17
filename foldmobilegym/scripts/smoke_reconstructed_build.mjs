// Environment diagnostic, not a screenshot-only agent run or benchmark score.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { assertEntryHealth, assertMediaBytes } from '../../tools/reviews/runtime_assertions.mjs';
import { waitForVisibleImages, readVisibleImageHealth } from '../../tools/reviews/visible_images.mjs';
import { attachTransportEvidence } from '../../tools/reviews/transport_evidence.mjs';

const url = process.argv[2] || 'http://127.0.0.1:3100/';
const browser = await puppeteer.launch({ headless: true,
  ...(process.env.FOLDAGENT_BROWSER_PATH ? { executablePath: process.env.FOLDAGENT_BROWSER_PATH } : {}) });
const errors = [], results = [], networkFailures = [];
let diagnosticPage;
let diagnosticSettlement;
let diagnosticHealth;
let transportEvidence;
try {
  const page = await browser.newPage();
  diagnosticPage = page;
  if (process.env.FOLDAGENT_SMOKE_TRANSPORT_EVIDENCE) {
    transportEvidence = await attachTransportEvidence(page, { origin: new URL(url).origin });
  }
  page.on('requestfailed', request => networkFailures.push({ url: request.url(), error: request.failure() }));
  page.on('response', response => { if (response.status() >= 400) networkFailures.push({ url: response.url(), status: response.status() }); });
  await page.setViewport({ width: 1440, height: 1100 });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__SIM__ && window.__FOLDAGENT__ && window.__FOLDAGENT_BENCH__), { timeout: 90000 });
  const installed = await page.evaluate(() => window.__SIM__.getState().os.installedApps.map(app => app.id));
  assert.deepEqual(installed.filter(id => ['workspace_docs', 'study_cards', 'food_info', 'video', 'fitness', 'tasks', 'calculator2'].includes(id)),
    [], 'Removed applications must not be installed, rather than silently skipped by smoke');
  const apps = installed.filter(id => !['app_picker', 'intent_chooser', 'permission_controller', 'package_installer'].includes(id));
  assert.equal(new Set(apps).size, apps.length, 'Duplicate installed app IDs');
  assert.equal(apps.length, 30, 'Current delivery must expose all 30 retained apps');
  assert.ok(apps.includes('meituan_waimai') && apps.includes('appstore') && apps.includes('redbook'));
  for (const posture of ['folded', 'unfolded']) {
    const actual = await page.evaluate(value => {
      window.__FOLDAGENT__.setPosture(value);
      return window.__FOLDAGENT__.getState().posture;
    }, posture);
    assert.equal(actual, posture);
    for (const id of apps) {
      diagnosticSettlement = undefined;
      diagnosticHealth = undefined;
      await page.evaluate(async id => {
        window.__OS__.goHome();
        window.__OS__.openApp(id);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, id);
      await page.waitForFunction(async id => {
        const root = document.querySelector(`[data-app-id="${id}"]`);
        return window.__OS__.getState().activeAppId === id && root
          && root.getBoundingClientRect().width > 0
          && !root.querySelector('[data-app-launch-splash]')
          && root.innerText.trim().length > 0;
      }, { timeout: 90000 }, id);
      await page.evaluate(async id => { await window.__SIM__.waitForData?.([id]); }, id);
      await new Promise(resolve => setTimeout(resolve, 400));
      const text = await page.$eval(`[data-app-id="${id}"]`, root => root.innerText);
      assert.ok(!/应用出现问题|Failed to fetch dynamically imported module/.test(text), `${id}: app error boundary`);
      diagnosticSettlement = await waitForVisibleImages(page, `[data-app-id="${id}"]`);
      const imageHealth = await readVisibleImageHealth(page, `[data-app-id="${id}"]`);
      diagnosticHealth = imageHealth;
      const layout = await page.$eval(`[data-app-id="${id}"]`, root => {
        return {
          overflow: root.scrollWidth > root.clientWidth + 2,
        };
      });
      layout.failedImages = imageHealth.failedImages;
      assertEntryHealth(layout, posture, id);
      results.push({ app: id, posture, loaded: true, ...layout });
      await page.evaluate(() => window.__OS__.goHome());
    }
  }
  assert.equal(results.length, 60, 'Every retained app must be checked in both postures');
  const groups = ['bilibili/', 'ebay/', 'map/', 'redbook/images/posts/', 'spotify/', 'taobao/', 'themes/', 'wallpapers/'];
  const manifest = JSON.parse(fs.readFileSync(new URL('../DATA_SNAPSHOT.json', import.meta.url), 'utf8'));
  for (const group of groups) {
    const item = manifest.files.find(file => file.path.startsWith(group) && file.bytes > 0);
    assert.ok(item, `Missing dataset group ${group}`);
    const response = await fetch(new URL(`/cdn/${item.path}`, url));
    assert.equal(response.status, 200, item.path);
    const bytes = Buffer.from(await response.arrayBuffer());
    assertMediaBytes(bytes, item);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, apps: results, postures: 2, dataset_groups: groups.length,
    foldagent_api: true, benchmark_api: true, page_errors: errors, scope: 'Build/runtime diagnostic only; no model calls or benchmark score' }));
} catch (error) {
  // Failure-only evidence, after the original assertion has already rejected.
  // No extra listeners, waits, retries or changed success conditions.
  if (process.env.FOLDAGENT_SMOKE_FAILURE_EVIDENCE && diagnosticPage) {
    const evidence = await diagnosticPage.evaluate(() => {
      const activeAppId = window.__OS__?.getState().activeAppId;
      const root = document.querySelector(`[data-app-id="${activeAppId}"]`);
      return {
        activeAppId,
        fontStatus: document.fonts.status,
        documentReadyState: document.readyState,
        images: [...(root?.querySelectorAll('img') ?? [])].map(image => ({
          src: image.getAttribute('src'), currentSrc: image.currentSrc,
          complete: image.complete, naturalWidth: image.naturalWidth,
          loading: image.loading, fetchPriority: image.fetchPriority,
          priorityAttribute: image.getAttribute('fetchpriority'),
          visibleNow: image.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
          rect: image.getBoundingClientRect().toJSON(),
        })),
        resources: performance.getEntriesByType('resource').slice(-200).map(entry => ({
          name: entry.name, startTime: entry.startTime, duration: entry.duration,
          responseEnd: entry.responseEnd, initiatorType: entry.initiatorType,
        })),
      };
    }).catch(e => ({ diagnosticError: String(e) }));
    try {
      fs.writeFileSync(process.env.FOLDAGENT_SMOKE_FAILURE_EVIDENCE, JSON.stringify({ error: String(error), settlement: diagnosticSettlement, health: diagnosticHealth, evidence }, null, 2));
    } catch (e) { console.warn('Could not write failure evidence:', String(e)); }
  }
  throw error;
} finally {
  // Write before browser shutdown cancels pending requests. Opt-in observation
  // adds no settlement waits and never changes the original assertions/budgets.
  if (transportEvidence) {
    try { fs.writeFileSync(process.env.FOLDAGENT_SMOKE_TRANSPORT_EVIDENCE, JSON.stringify(transportEvidence.snapshot(), null, 2)); }
    catch (error) { console.warn('Could not write transport evidence:', error.name); }
    await transportEvidence.stop();
  }
  if (process.env.FOLDAGENT_SMOKE_NETWORK_EVIDENCE) fs.writeFileSync(process.env.FOLDAGENT_SMOKE_NETWORK_EVIDENCE,
    JSON.stringify({ results, errors, networkFailures }, null, 2));
  await browser.close();
}
