/**
 * Launch every installed app and verify folded → unfolded → folded continuity.
 * Run while Vite dev or preview is serving, for example:
 *   node scripts/smoke_foldable_apps.mjs http://127.0.0.1:3100/
 */
import puppeteer from 'puppeteer';
import { visibleAppIds, reportAudit } from './audit_app_catalog.mjs';

const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
let appIds = [];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
const issues = [];
const page = await browser.newPage();
page.on('pageerror', (error) => issues.push({ appId: 'page', issue: error.message }));

try {
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__), { timeout: 30000 });
  appIds = await visibleAppIds(page);
  if (!appIds.length) throw new Error('No visible apps found; refusing empty coverage');

  for (const appId of appIds) {
    await page.evaluate((id) => window.__OS__.openApp(id), appId);
    try {
      await page.waitForFunction((id) => {
        const app = document.querySelector(`[data-app-id="${id}"]`);
        return app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
      }, { timeout: 20000 }, appId);
    } catch {
      issues.push({ appId, issue: 'App did not show content within 20 seconds' });
      await page.evaluate((id) => window.__OS__.closeApp(id), appId);
      continue;
    }

    for (const posture of ['folded', 'unfolded', 'folded']) {
      await page.evaluate((value) => window.__FOLDAGENT__.setPosture(value), posture);
      const expectedSize = posture === 'folded' ? 'compact' : 'expanded';
      try {
        await page.waitForFunction(([id, size]) => {
          const app = document.querySelector(`[data-app-id="${id}"]`);
          return app?.dataset.windowSizeClass === size && app.getBoundingClientRect().width > 100;
        }, { timeout: 3000 }, [appId, expectedSize]);
      } catch {
        issues.push({ appId, posture, issue: 'Viewport transition did not settle' });
      }
      const badContent = await page.evaluate((id) => {
        const text = document.querySelector(`[data-app-id="${id}"]`)?.innerText.trim() ?? '';
        return !text || text.includes('应用出现问题');
      }, appId);
      if (badContent) issues.push({ appId, posture, issue: 'Blank or app error screen' });
    }
    await page.evaluate((id) => window.__OS__.closeApp(id), appId);
  }
} finally {
  await browser.close();
}

reportAudit({ checked: appIds.length, appIds, scope: 'Visible app first-screen folded/unfolded opening diagnostic', issues });
if (issues.length) process.exitCode = 1;
