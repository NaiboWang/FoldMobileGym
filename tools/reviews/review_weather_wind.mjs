import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const root = path.resolve(import.meta.dirname, '../..');
const front = existsSync(path.join(root, 'foldmobilegym/package.json')) ? 'foldmobilegym' : 'mobilegym';
const require = createRequire(path.join(root, front, 'package.json'));
const browserPath = process.env.FOLDAGENT_BROWSER_PATH || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
assert.ok(browserPath && existsSync(browserPath), 'Set FOLDAGENT_BROWSER_PATH to an installed Chromium browser');
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3422/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname));
const browser = await require('puppeteer').launch({headless:true, executablePath:browserPath});
const results=[];
try {
 for (const posture of ['folded','unfolded']) for (const wind360 of ['', '--', '0', '90']) {
  const context = await browser.createBrowserContext(), page = await context.newPage(), errors=[];
  try {
   page.on('pageerror', e => errors.push(e.message));
   await page.setRequestInterception(true);
   page.on('request', req => { const u=new URL(req.url()); if ((['localhost','127.0.0.1'].includes(u.hostname) && ['GET','HEAD'].includes(req.method())) || ['data:','blob:'].includes(u.protocol)) req.continue(); else req.abort(); });
   await page.setViewport({width:1440,height:1100});
   await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(() => window.__OS__ && window.__SIM__ && window.__FOLDAGENT__);
   await page.evaluate(async ({posture,wind360}) => {
    window.__FOLDAGENT__.setPosture(posture); await window.__SIM__.preloadAppStores(['weather']);
    const state=window.__SIM__.getState().apps.weather;
    const weatherLibrary=Object.fromEntries(Object.entries(state.weatherLibrary).map(([key,entry]) => [key,{...entry,bundle:entry.bundle ? {...entry.bundle, now:{...entry.bundle.now,wind360}} : entry.bundle}]));
    window.__SIM__.setState({apps:{weather:{...state,selectedCityId:'beijing',bundlesByCityId:{},weatherLibrary}}},{deep:false,reload:false});
   },{posture,wind360});
   await page.evaluate(async () => {
    window.__OS__.openApp('weather','/');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
   });
   await page.waitForFunction(() => window.__OS__.getState().activeAppId === 'weather' && window.__OS__.getAppRoute('weather')?.path === '/');
   await page.waitForSelector('[data-app-id="weather"] .weather-reference-wind svg');
   const compasses=await page.$$eval('[data-app-id="weather"] .weather-reference-wind svg', els=>els.map(el=>el.querySelector('g')?.getAttribute('transform') ?? null));
   const expected=wind360 === '0' || wind360 === '90' ? `rotate(${wind360} 50 50)` : null;
   assert.ok(compasses.length>0); assert.ok(compasses.every(angle=>angle===expected),JSON.stringify(compasses));
   assert.deepEqual(errors,[]); results.push({posture,wind360}); console.log('PASS',posture,JSON.stringify(wind360));
  } finally { await context.close(); }
 }
} finally { await browser.close(); }
console.log(JSON.stringify({passed:true,results,scope:'Synthetic wind angles; not live weather or native visual parity.'}));
