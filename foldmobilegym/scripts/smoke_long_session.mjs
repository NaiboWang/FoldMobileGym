/** Repeatedly open/close user-visible apps in one browser session. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const cycles = Number(process.argv.find((arg) => arg.startsWith('--cycles='))?.slice(9) || 3);
const appFilter = process.argv.find((arg) => arg.startsWith('--app='))?.slice(6);
const settleMs = Number(process.argv.find((arg) => arg.startsWith('--settle-ms='))?.slice(12) || 5000);
if (!Number.isInteger(cycles) || cycles < 1 || cycles > 10) throw new Error('cycles must be 1–10');
if (!Number.isInteger(settleMs) || settleMs < 0 || settleMs > 60000) throw new Error('settle-ms must be 0–60000');
const installedAppIds = ['apps', 'system'].flatMap((group) =>
  fs.readdirSync(path.join(root, group)).flatMap((directory) => {
    const manifest = path.join(root, group, directory, 'manifest.ts');
    if (!fs.existsSync(manifest)) return [];
    const id = fs.readFileSync(manifest, 'utf8').match(/\bid:\s*['"]([^'"]+)['"]/)?.[1];
    return id && id !== 'workspace_docs' ? [id] : [];
  }),
);
const appIds = appFilter ? installedAppIds.filter((id) => id === appFilter) : installedAppIds;
if (!appIds.length) throw new Error(`No visible app matched --app=${appFilter}`);

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const cdp = await page.createCDPSession();
const issues = [];
const heapAfterCycle = [];
const domAfterCycle = [];
let settledMemory = null;
const switchApps = appFilter ? [appFilter] : ['redbook', 'reddit', 'meituan_waimai', 'notes', 'weather'];
let currentApp = 'launcher';
page.on('pageerror', (error) => issues.push({ cycle: 'runtime', appId: currentApp, issue: error.message }));

try {
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    for (const appId of appIds) {
      currentApp = appId;
      try {
        await page.evaluate((id) => window.__OS__.openApp(id), appId);
        await page.waitForFunction((id) => {
          const app = document.querySelector(`[data-app-id="${id}"]`);
          return window.__OS__.getState().activeAppId === id
            && app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
        }, { timeout: 20000 }, appId);
        if (appId === 'map') {
          await page.waitForFunction(() => Boolean(window.__mapInstance), { timeout: 20000 });
          const reused = await page.evaluate(() => {
            const map = window.__mapInstance;
            if (!window.__longSessionMapRef) {
              window.__longSessionMapRef = new WeakRef(map);
              return true;
            }
            return window.__longSessionMapRef.deref() === map;
          });
          if (!reused) throw new Error('Map instance was recreated after closing the app');
        }
        const crashed = await page.$eval(`[data-app-id="${appId}"]`, (app) =>
          app.innerText.includes('应用出现问题') || app.innerText.includes('App encountered a problem'));
        if (crashed) throw new Error('App error boundary is visible');
      } catch (error) {
        issues.push({ cycle, appId, issue: String(error?.message ?? error) });
      } finally {
        await page.evaluate((id) => window.__OS__.closeApp(id), appId);
        try {
          await page.waitForFunction(() => {
            const state = window.__OS__.getState();
            return state.tasks.length === 0 && state.activeAppId === null
              && state.isLauncherVisible && !!document.querySelector('[data-launcher="true"]')
              && document.querySelectorAll('[data-app-id]').length === 0
              && !window.__mapInstance;
          }, { timeout: 10000 });
        } catch {
          const state = await page.evaluate(() => ({
            tasks: window.__OS__?.getState().tasks.length,
            activeAppId: window.__OS__?.getState().activeAppId,
            activityDomCount: document.querySelectorAll('[data-app-id]').length,
          }));
          issues.push({ cycle, appId, issue: 'Closing app did not restore clean launcher', state });
        }
      }
    }
    await cdp.send('HeapProfiler.collectGarbage');
    heapAfterCycle.push(Math.round((await page.metrics()).JSHeapUsedSize / 1024 / 1024));
    domAfterCycle.push(await cdp.send('Memory.getDOMCounters'));
  }
  // Keep several tasks alive and revisit them, matching ordinary Home → app switching.
  for (let round = 1; round <= 3; round += 1) {
    for (const appId of switchApps) {
      currentApp = appId;
      try {
        await page.evaluate((id) => window.__OS__.openApp(id), appId);
        await page.waitForFunction((id) => {
          const app = document.querySelector(`[data-app-id="${id}"]`);
          return window.__OS__.getState().activeAppId === id && app
            && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]')
            && !app.innerText.includes('应用出现问题');
        }, { timeout: 20000 }, appId);
        const count = await page.evaluate(() => window.__OS__.getState().tasks.length);
        if (count !== switchApps.length) {
          // The first round intentionally grows the task set one app at a time.
          const expected = round === 1 ? switchApps.indexOf(appId) + 1 : switchApps.length;
          if (count !== expected) throw new Error(`Task count ${count}, expected ${expected}`);
        }
      } catch (error) {
        issues.push({ round, appId, issue: String(error?.message ?? error) });
      } finally {
        await page.evaluate(() => window.__OS__.goHome());
        await page.waitForFunction(() => window.__OS__.getState().activeAppId === null
          && document.querySelector('[data-launcher="true"]'), { timeout: 10000 });
      }
    }
  }
  for (const appId of switchApps) {
    await page.evaluate((id) => window.__OS__.closeApp(id), appId);
  }
  await page.waitForFunction(() => window.__OS__.getState().tasks.length === 0
    && document.querySelectorAll('[data-app-id]').length === 0, { timeout: 10000 });
  await new Promise((resolve) => setTimeout(resolve, settleMs));
  await cdp.send('HeapProfiler.collectGarbage');
  settledMemory = {
    heapMiB: Math.round((await page.metrics()).JSHeapUsedSize / 1024 / 1024),
    dom: await cdp.send('Memory.getDOMCounters'),
  };
} finally {
  await browser.close();
}

console.log(JSON.stringify({ apps: appIds.length, cycles, settleMs, checked: appIds.length * cycles,
  warmTaskSwitches: switchApps.length * 3, heapMiB: heapAfterCycle, domCounters: domAfterCycle,
  settledMemory, issues }, null, 2));
if (issues.length) process.exitCode = 1;
