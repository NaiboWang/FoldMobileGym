// Isolated browser check of the unpacked extension's toolbar action and popup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../..');
const front = fs.existsSync(path.join(root, 'mobilegym/package.json')) ? 'mobilegym' : 'foldmobilegym';
const extensionDir = path.join(root, front === 'mobilegym' ? 'browser-extension' : 'tools/browser-extension');
const require = createRequire(path.join(root, front, 'package.json'));
const puppeteer = require('puppeteer');
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3312/');
assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
assert.ok(executablePath, 'Set FOLDAGENT_BROWSER_PATH to a supported browser');
const browser = await puppeteer.launch({ headless: true, executablePath, enableExtensions: true, pipe: true, args: ['--disable-background-networking'] });
try {
  const id = await browser.installExtension(extensionDir);
  const extension = (await browser.extensions()).get(id);
  assert.ok(extension, 'Unpacked extension must be installed in the isolated browser');
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    const target = new URL(request.url());
    if (request.method() === 'GET' && ((target.origin === url.origin && !/^\/api(?:\/|$)/.test(target.pathname)) || ['data:', 'blob:'].includes(target.protocol))) request.continue();
    else request.abort();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__FOLDAGENT__ && window.__OS__);
  await page.evaluate(() => { window.__FOLDAGENT__.setPosture('unfolded'); window.__OS__.openApp('clock'); window.__OS__.openApp('calculator'); });
  await page.waitForFunction(() => window.__OS__.getState().tasks.some(t => t.rootAppId === 'clock') && window.__OS__.getState().tasks.some(t => t.rootAppId === 'calculator'));
  const openPopup = async () => {
    await page.bringToFront();
    await extension.triggerAction(page);
    for (let i = 0; i < 50; i++) {
      const popup = (await extension.pages())[0];
      if (popup) return popup;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('Extension popup did not appear');
  };
  let popup = await openPopup();
  await popup.waitForFunction(() => document.getElementById('status')?.textContent === '已连接本地 foldmobilegym');
  const tasks = await page.evaluate(() => {
    const list = window.__OS__.getState().tasks;
    return { clock: list.find(t => t.rootAppId === 'clock').taskId, calculator: list.find(t => t.rootAppId === 'calculator').taskId };
  });
  await popup.select('#primary', tasks.clock);
  await popup.select('#secondary', tasks.calculator);
  await popup.click('[data-mode="split"]');
  await page.waitForFunction(() => window.__FOLDAGENT__.getState().multi_window.mode === 'split');
  await popup.waitForFunction(() => !document.querySelector('[data-posture="folded"]').disabled);
  await popup.click('[data-posture="folded"]');
  await page.waitForFunction(() => window.__FOLDAGENT__.getState().posture === 'folded' && window.__FOLDAGENT__.getState().multi_window.mode === 'split');
  await page.waitForFunction(() => {
    const a = document.querySelector('[data-app-id="clock"]')?.getBoundingClientRect();
    const b = document.querySelector('[data-app-id="calculator"]')?.getBoundingClientRect();
    return a && b && (a.bottom <= b.top + 4 || b.bottom <= a.top + 4);
  });
  await popup.waitForFunction(() => !document.querySelector('[data-posture="unfolded"]').disabled);
  await popup.click('[data-posture="unfolded"]');
  await page.waitForFunction(() => window.__FOLDAGENT__.getState().posture === 'unfolded');
  await popup.close();
  const benchmark = new URL(url); benchmark.searchParams.set('foldagent_benchmark', '1');
  await page.goto(benchmark.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__FOLDAGENT__ && window.__OS__);
  popup = await openPopup();
  await popup.waitForFunction(() => document.getElementById('status')?.textContent.includes('评测模式'));
  assert.equal(await popup.$eval('[data-posture="folded"]', node => node.disabled), true);
  assert.equal(await popup.$eval('#refresh', node => node.disabled), false);
  console.log('PASS isolated extension installation, toolbar action, split/fold/unfold and benchmark read-only');
} finally { await browser.close(); }
