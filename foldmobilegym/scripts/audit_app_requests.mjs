/** Collect same-origin resource failures while opening each installed app. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const english = process.argv.includes('--en');
const origin = new URL(siteUrl).origin;
const appIds = ['apps', 'system'].flatMap((group) =>
  fs.readdirSync(path.join(root, group)).flatMap((directory) => {
    const manifest = path.join(root, group, directory, 'manifest.ts');
    if (!fs.existsSync(manifest)) return [];
    const match = fs.readFileSync(manifest, 'utf8').match(/\bid:\s*['"]([^'"]+)['"]/);
    return match ? [match[1]] : [];
  }),
);

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const findings = [];
let currentAppId = 'launcher';

try {
  page.on('response', (response) => {
    if (response.status() < 400 || !response.url().startsWith(origin)) return;
    findings.push({ appId: currentAppId, kind: 'http', status: response.status(), url: response.url() });
  });
  page.on('requestfailed', (request) => {
    if (!request.url().startsWith(origin)) return;
    // Closing an app can cancel image requests that are no longer needed.
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    findings.push({ appId: currentAppId, kind: 'request', failure: request.failure()?.errorText, url: request.url() });
  });
  page.on('pageerror', (error) => findings.push({ appId: currentAppId, kind: 'pageerror', message: error.message }));

  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__), { timeout: 30000 });
  if (english) await page.evaluate(() => window.__OS__.locale.setLocale('en'));
  await page.waitForSelector('[data-launcher="true"]', { timeout: 30000 });
  for (const appId of appIds) {
    currentAppId = appId;
    await page.evaluate((id) => window.__OS__.openApp(id), appId);
    try {
      await page.waitForFunction((id) => {
        const app = document.querySelector(`[data-app-id="${id}"]`);
        return app && app.innerText.trim().length > 0 && !app.querySelector('[data-app-launch-splash]');
      }, { timeout: 20000 }, appId);
      await new Promise((resolve) => setTimeout(resolve, 700));
      const crashed = await page.$eval(`[data-app-id="${appId}"]`, (app) =>
        app.innerText.includes('应用出现问题') || app.innerText.includes('App encountered a problem'));
      if (crashed) findings.push({ appId, kind: 'app-error-boundary' });
    } catch (error) {
      findings.push({ appId, kind: 'launch-timeout', message: String(error?.message ?? error) });
    } finally {
      await page.evaluate((id) => window.__OS__.closeApp(id), appId);
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ locale: english ? 'en' : 'zh', checked: appIds.length, findings }, null, 2));
if (findings.length) process.exitCode = 1;
