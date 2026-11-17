/** Audit broken visible images on the first screen of every installed app. */
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
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  appIds = await visibleAppIds(page);
  if (!appIds.length) throw new Error('No visible apps found; refusing empty coverage');
  if (english) await page.evaluate(() => window.__OS__.locale.setLocale('en'));
  for (const appId of appIds) {
    await page.evaluate((id) => window.__OS__.openApp(id), appId);
    try {
      await page.waitForFunction((id) => {
        const app = document.querySelector(`[data-app-id="${id}"]`);
        return app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
      }, { timeout: 20000 }, appId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await page.waitForFunction(id => [...(document.querySelector(`[data-app-id="${id}"]`)?.querySelectorAll('img') ?? [])]
        .filter(image => {
          const rect = image.getBoundingClientRect();
          return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0
            && rect.top < innerHeight && rect.left < innerWidth;
        // X already gives direct and proxy loads 5s each before fallback.
        // Allow that declared recovery window rather than flagging it at 3s.
        }).every(image => image.complete), { timeout: 12000 }, appId).catch(() => {});
      const result = await page.evaluate((id) => {
        const app = document.querySelector(`[data-app-id="${id}"]`);
        const visible = [...(app?.querySelectorAll('img') ?? [])].filter((image) => {
          const rect = image.getBoundingClientRect();
          const style = getComputedStyle(image);
          return rect.width > 8 && rect.height > 8 && rect.bottom > 0 && rect.right > 0
            && rect.top < innerHeight && rect.left < innerWidth
            && style.visibility !== 'hidden' && style.display !== 'none';
        });
        return {
          visible: visible.length,
          pending: visible.filter(image => !image.complete)
            .map(image => ({ src: image.currentSrc || image.src, alt: image.alt })).slice(0, 12),
          broken: visible.filter((image) => image.complete && image.naturalWidth === 0)
            .map((image) => ({ src: image.currentSrc || image.src, alt: image.alt })).slice(0, 12),
        };
      }, appId);
      if (result.broken.length || result.pending.length) findings.push({ appId, ...result });
    } catch (error) {
      findings.push({ appId, error: String(error?.message ?? error) });
    } finally {
      await page.evaluate((id) => window.__OS__.closeApp(id), appId);
    }
  }
} finally {
  await browser.close();
}

reportAudit({ locale: english ? 'en' : 'zh', checked: appIds.length, appIds, scope: 'Visible images on app first screens only', findings });
if (findings.length) process.exitCode = 1;
