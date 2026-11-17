/** Browser check for the requested launcher wallpaper and installed app set. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = process.argv[2] || 'http://127.0.0.1:3100/';
const appIds = ['apps', 'system'].flatMap((group) =>
  fs.readdirSync(path.join(root, group)).flatMap((directory) => {
    const manifest = path.join(root, group, directory, 'manifest.ts');
    if (!fs.existsSync(manifest)) return [];
    const match = fs.readFileSync(manifest, 'utf8').match(/\bid:\s*['"]([^'"]+)['"]/);
    return match ? [match[1]] : [];
  }),
);
if (!appIds.includes('meituan_waimai')) throw new Error('Meituan is not installed');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
try {
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__OS__ && window.__FOLDAGENT__), { timeout: 30000 });
  await page.waitForSelector('[data-launcher="true"]', { timeout: 20000 });
  const wallpaper = await page.evaluate(async () => {
    const launcher = document.querySelector('[data-launcher="true"]');
    if (!launcher) throw new Error('Launcher is not visible');
    const background = getComputedStyle(launcher.firstElementChild).backgroundImage;
    const url = background.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
    if (!url) throw new Error(`Launcher has no image wallpaper: ${background}`);
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error(`Wallpaper decoded empty: ${url}`);
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  });
  for (const posture of ['unfolded', 'folded']) {
    await page.evaluate((value) => window.__FOLDAGENT__.setPosture(value), posture);
    await page.waitForFunction((value) => {
      const launcher = document.querySelector('[data-launcher="true"]');
      return launcher && getComputedStyle(launcher.firstElementChild).backgroundImage.includes(value);
    }, { timeout: 5000 }, wallpaper.url.split('/').pop());
  }
  const wpsVisibleOnLauncher = await page.evaluate(() => document.querySelector('[data-launcher="true"]')?.innerText.includes('WPS Office'));
  if (wpsVisibleOnLauncher) throw new Error('WPS Office is visible on the launcher');
  await page.click('[data-launcher="true"] button[aria-label="搜索"]');
  await page.type('[data-launcher="true"] input[type="search"]', 'WPS');
  await page.waitForFunction(() => document.querySelector('[data-launcher="true"]')?.innerText.includes('未找到应用'),
    { timeout: 10000 });
  await page.click('[data-launcher="true"] button[aria-label="关闭搜索"]');
  await page.evaluate(() => window.__OS__.openApp('meituan_waimai'));
  await page.waitForFunction(() => {
    const app = document.querySelector('[data-app-id="meituan_waimai"]');
    return app && app.innerText.trim().length > 0 && !app.innerText.includes('应用出现问题');
  }, { timeout: 20000 });
  console.log(JSON.stringify({ manifestFiles: appIds.length, wallpaper, meituanOpened: true, wpsHiddenFromLauncherAndSearch: true }, null, 2));
} finally {
  await browser.close();
}
