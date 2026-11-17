/** Report horizontal overflow at folded and unfolded simulator postures. */
import puppeteer from 'puppeteer';
import { visibleAppIds, reportAudit } from './audit_app_catalog.mjs';

const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const english = process.argv.includes('--en');
let appIds = [];
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const findings = [];
try {
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__), { timeout: 30000 });
  appIds = await visibleAppIds(page);
  if (!appIds.length) throw new Error('No visible apps found; refusing empty coverage');
  if (english) await page.evaluate(() => window.__OS__.locale.setLocale('en'));
  for (const appId of appIds) {
    await page.evaluate((id) => window.__OS__.openApp(id), appId);
    await page.waitForFunction((id) => {
      const app = document.querySelector(`[data-app-id="${id}"]`);
      return app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
    }, { timeout: 20000 }, appId);
    for (const posture of ['folded', 'unfolded']) {
      await page.evaluate((value) => window.__FOLDAGENT__.setPosture(value), posture);
      await page.waitForFunction(([id, size]) =>
        document.querySelector(`[data-app-id="${id}"]`)?.dataset.windowSizeClass === size,
      { timeout: 5000 }, [appId, posture === 'folded' ? 'compact' : 'expanded']);
      await new Promise((resolve) => setTimeout(resolve, 150));
      const measurement = await page.evaluate((id) => {
        const app = document.querySelector(`[data-app-id="${id}"]`);
        return {
          width: app?.clientWidth ?? 0,
          appOverflow: Math.max(0, (app?.scrollWidth ?? 0) - (app?.clientWidth ?? 0)),
          documentOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        };
      }, appId);
      if (measurement.appOverflow > 8 || measurement.documentOverflow > 8) {
        findings.push({ appId, posture, ...measurement });
      }
    }
    await page.evaluate((id) => window.__OS__.closeApp(id), appId);
  }
} finally {
  await browser.close();
}

reportAudit({ locale: english ? 'en' : 'zh', checked: appIds.length, appIds, scope: 'App/document horizontal overflow on folded/unfolded first screens (>8px)', findings });
if (findings.length) process.exitCode = 1;
