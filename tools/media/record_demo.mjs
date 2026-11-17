// Record only the local simulator in a disposable browser context; no private reference video.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3100/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const output = path.resolve(process.env.FOLDAGENT_DEMO_OUTPUT || path.join(root, 'artifacts/foldmobilegym-demo.mp4'));
assert.ok(!fs.existsSync(output), 'Never overwrite an existing recording');
fs.mkdirSync(path.dirname(output), { recursive: true });
const browser = await require('puppeteer').launch({ headless: true, executablePath: resolveBrowserExecutable() });
const errors = [], chapters = [];
const staging = fs.mkdtempSync(path.join(path.dirname(output), '.demo-record-'));
const stagedVideo = path.join(staging, 'recording.mp4');
const encodedVideo = path.join(staging, 'encoded.mp4');
let recorder;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
  await page.evaluate(() => { window.__OS__.locale.setLocale('zh-Hans'); window.__FOLDAGENT__.setPosture('folded'); window.__OS__.goHome(); });
  await wait(1500);
  recorder = await page.screencast({ path: stagedVideo, format: 'mp4', fps: 20, overwrite: true,
    ...(process.env.FOLDAGENT_FFMPEG_PATH ? { ffmpegPath: process.env.FOLDAGENT_FFMPEG_PATH } : {}) });
  const mark = async title => {
    chapters.push(title);
    await page.evaluate(title => {
      let label = document.getElementById('foldmobilegym-demo-chapter');
      if (!label) { label = document.createElement('div'); label.id = 'foldmobilegym-demo-chapter'; Object.assign(label.style, {position:'fixed',left:'24px',top:'24px',zIndex:'2147483647',padding:'10px 16px',borderRadius:'10px',background:'#1c2737',color:'white',font:'18px sans-serif',pointerEvents:'none'}); document.body.appendChild(label); }
      label.textContent = title;
    }, title);
  };
  const posture = async value => { await page.evaluate(value => window.__FOLDAGENT__.setPosture(value), value); await wait(2800); };
  await mark('折叠屏桌面'); await wait(2600);
  await mark('展开屏桌面'); await posture('unfolded');
  await mark('日历 · 双形态适配'); await openPilotApp(page, 'calendar', '/'); await wait(3000); await posture('folded'); await posture('unfolded');
  await mark('天气 · 页面滚动'); await openPilotApp(page, 'weather', '/'); await wait(3000);
  await page.$eval('[data-app-id="weather"] [data-scroll-container="main"]', el => el.scrollTo({ top: 570, behavior: 'smooth' })); await wait(2600);
  await posture('folded');
  await mark('微信 · 本地模拟会话'); await openPilotApp(page, 'wechat', '/'); await wait(3600); await posture('unfolded');
  await mark('美团 · 展开屏浏览'); await openPilotApp(page, 'meituan_waimai', '/'); await wait(4000);
  await mark('时钟 · 闹钟'); await openPilotApp(page, 'clock', '/'); await wait(3500); await posture('folded');
  await mark('计算器 · 折叠屏'); await openPilotApp(page, 'calculator', '/'); await wait(3500);
  await mark('分屏 · 从桌面选择第二个应用'); await posture('unfolded');
  await openPilotApp(page, 'reddit', '/create');
  const title = '[data-app-id="reddit"] [data-action="create.title.input"]';
  await page.waitForSelector(title, { visible: true }); await page.type(title, 'foldmobilegym demo - retained split draft', { delay: 55 });
  await page.evaluate(() => { document.activeElement?.blur(); window.__OS__.keyboard.hide(); }); await wait(1600);
  const bar = await (await page.$('[data-gesture-bar]')).boundingBox();
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height - 4); await page.mouse.down();
  await page.mouse.move(bar.x + bar.width * .22, bar.y - 240, { steps: 18 }); await page.mouse.up();
  const picker = '[data-window-picker="split"]'; await page.waitForSelector(picker, { visible: true }); await wait(2400);
  await page.click(`${picker} [data-launcher-app="clock"]`);
  await page.waitForFunction(() => window.__FOLDAGENT__.getState().multi_window.mode === 'split'); await wait(3000);
  await mark('折叠后左右分屏切换为上下分屏'); await posture('folded'); await posture('unfolded');
  assert.equal(await page.$eval(title, el => el.value), 'foldmobilegym demo - retained split draft');
  assert.deepEqual(errors, []);
  await recorder.stop(); recorder = null;
  execFileSync(process.env.FOLDAGENT_FFMPEG_PATH || 'ffmpeg', ['-nostdin', '-v', 'error', '-i', stagedVideo, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-n', encodedVideo], { windowsHide: true });
  fs.linkSync(encodedVideo, output); // Exclusive publication; never overwrite the requested output.
  fs.unlinkSync(stagedVideo); fs.unlinkSync(encodedVideo); fs.rmdirSync(staging);
  const report = { passed: true, output, source: url.href, data: 'Disposable local simulated app data only; not the private phone reference recording', chapters, timing: 'Automated edited-rate capture; not a real-time performance measurement', errors };
  fs.writeFileSync(output + '.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  if (recorder) await recorder.stop();
  await browser.close();
}
