import fs from 'node:fs';
import path from 'node:path';
import { parseLocalPreview, allowCaptureRequest, illustrativeCover } from './capture_safety.mjs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../foldmobilegym/package.json', import.meta.url));
const puppeteer = require('puppeteer');
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
const preview = parseLocalPreview(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3188/');
const artifacts = path.resolve(import.meta.dirname, '../../artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const output = fs.mkdtempSync(path.join(artifacts, 'readme-capture-'));
// Screenshot capture is not permission to redistribute depicted assets or content.

const browser = await puppeteer.launch({ headless: true, executablePath: resolveBrowserExecutable() });
try {
const page = await browser.newPage();
let blockedRequests = 0, mockedImages = 0, useIllustrativeCovers = false;
await page.setCacheEnabled(false);
await page.setBypassServiceWorker(true);
await page.setRequestInterception(true);
page.on('request', request => {
  if (useIllustrativeCovers && request.resourceType() === 'image' && request.method() === 'GET') {
    mockedImages++; void request.respond({ status: 200, contentType: 'image/svg+xml', body: illustrativeCover(request.url()) });
  } else if (allowCaptureRequest(preview, request.url(), request.method())) void request.continue();
  else { blockedRequests++; void request.abort(); }
});
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await page.goto(preview.href, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
await page.evaluate(() => window.__OS__.locale.setLocale('zh-Hans'));
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 500)); };
const posture = async value => { await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), value); await settle(); };
const whole = async name => {
  const rect = await page.$eval('#root', node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; });
  const padding = 12;
  const clip = {x: Math.floor(rect.x-padding), y: Math.floor(rect.y-padding), width: Math.ceil(rect.width+2*padding), height: Math.ceil(rect.height+2*padding)};
  if (clip.x < 0 || clip.y < 0 || clip.x+clip.width > 1440 || clip.y+clip.height > 1100) throw new Error('Screen outline falls outside screenshot viewport');
  await page.screenshot({path:path.join(output,name),clip});
};
const app = async (id, route = '/') => { await openPilotApp(page, id, route); await settle(); };
await posture('folded'); await page.evaluate(() => window.__OS__.goHome()); await settle(); await whole('launcher-folded.png');
await posture('unfolded'); await page.evaluate(() => window.__OS__.goHome()); await settle(); await whole('launcher-unfolded.png');
useIllustrativeCovers = true;
await app('spotify', '/?tab=all');
await page.waitForSelector('[data-app-id="spotify"] .spotify-source-pane [data-trigger="player.open"]', { visible: true });
await page.click('[data-app-id="spotify"] .spotify-source-pane [data-trigger="player.open"]');
await page.waitForSelector('[data-app-id="spotify"] .spotify-player-pane [data-trigger="player.layout.parallel"]', { visible: true });
await page.click('[data-app-id="spotify"] .spotify-player-pane [data-trigger="player.layout.parallel"]'); await settle();
if (mockedImages === 0) throw new Error('Expected illustrative Spotify artwork requests');
const unmockedInline = await page.$$eval('[data-app-id="spotify"] img', images => images.some(image => /^(data|blob):/i.test(image.currentSrc || image.src)));
if (unmockedInline) throw new Error('Spotify screenshot contains unreviewed inline artwork');
await whole('spotify-parallel-player.png');
useIllustrativeCovers = false;
await app('calendar', '/'); await whole('calendar-unfolded.png');
await app('meituan_waimai', '/'); await whole('meituan-unfolded.png');
await app('wechat', '/'); await whole('wechat-unfolded.png');
await app('clock', '/'); await whole('clock-unfolded.png');
await app('calculator', '/'); await whole('calculator-unfolded.png');
await posture('folded');
await app('wechat', '/'); await whole('wechat-folded.png');
await app('clock', '/'); await whole('clock-folded.png');
await app('meituan_waimai', '/'); await whole('meituan-folded.png');
console.log(JSON.stringify({ passed: true, output, blockedRequests, mockedImages, files: fs.readdirSync(output).filter(name => name.endsWith('.png')),
  rights: 'Spotify image requests use illustrative original vectors; every screenshot still requires independent privacy and rights review.' }));
} finally { await browser.close(); }

