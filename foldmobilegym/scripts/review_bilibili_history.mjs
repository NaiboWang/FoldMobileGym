import assert from 'node:assert/strict';
import {setBilibiliReviewLocale} from './bilibili_review_locale.mjs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const require=createRequire(path.resolve(import.meta.dirname,'../package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3201/');
assert.ok(url.protocol==='http:' && ['127.0.0.1','localhost'].includes(url.hostname));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const checks=[];
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const context=await browser.createBrowserContext(), page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{const u=new URL(r.url());return r.method()==='GET' && (u.origin===url.origin||['data:','blob:'].includes(u.protocol))?r.continue():r.abort();});
  await page.setViewport({width:1440,height:1100});
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
  await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);
  await setBilibiliReviewLocale(page,locale,openPilotApp);
  await openPilotApp(page,'bilibili','/me');
  const id=await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.favoritesFolders.flatMap(f=>f.videoIds||[])[0]);
  assert.ok(id);
  await openPilotApp(page,'bilibili',`/video/${id}?tab=intro`);
  await page.waitForFunction(value=>window.__SIM__.getState().apps.bilibili.user.videoHistory?.[0]===value,{},id);
  await openPilotApp(page,'bilibili','/me');
  const shortcut=await page.waitForFunction(value=>[...document.querySelectorAll('[data-app-id="bilibili"] *')].find(e=>e.checkVisibility()&&e.children.length===0&&e.textContent?.trim()===(value==='en'?'History':'历史记录')),{},locale);
  await shortcut.click();
  await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili').path==='/history');
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-app-id="bilibili"] [data-scroll-container="main"] button')].find(e=>e.checkVisibility()));
  const timestamp=await page.evaluate(value=>window.__SIM__.getState().apps.bilibili.user.videoHistorySeenAt?.[value],id);
  assert.ok(Number.isFinite(timestamp));
  const shown=await page.waitForFunction(()=>[...document.querySelectorAll('[data-app-id="bilibili"] [data-history-time]')].find(e=>e.checkVisibility()));
  assert.match(await page.evaluate(e=>e.textContent,shown),locale==='en'?/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/:/\d{4}年\d{2}月\d{2}日 \d{2}:\d{2}/);
  const master=await page.evaluate(()=>[...document.querySelectorAll('.bili-favorites-master')].some(e=>e.checkVisibility()));
  assert.equal(master,posture==='unfolded');
  if (posture === 'unfolded') {
   const favoriteShortcut=await page.waitForFunction(value=>[...document.querySelectorAll('.bili-favorites-master *')].find(e=>e.checkVisibility() && e.children.length===0 && e.textContent?.trim()===(value==='en'?'Favorites':'我的收藏')),{},locale);
   await favoriteShortcut.click();
   await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili').path.startsWith('/favorites'));
   const historyShortcut=await page.waitForFunction(value=>[...document.querySelectorAll('.bili-favorites-master *')].find(e=>e.checkVisibility() && e.children.length===0 && e.textContent?.trim()===(value==='en'?'History':'历史记录')),{},locale);
   await historyShortcut.click();
   await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili').path==='/history');
  }
  const visibleEntry=await page.waitForFunction(()=>[...document.querySelectorAll('[data-app-id="bilibili"] [data-scroll-container="main"] button')].find(e=>e.checkVisibility()));
  await visibleEntry.click();
  await page.waitForFunction(value=>window.__OS__.getAppRoute('bilibili').path.startsWith('/video/'+value),{},id);
  await openPilotApp(page,'bilibili','/history');
  const missing='test-unavailable-video';
  await page.evaluate(({missing,id})=>window.__SIM__.setState({apps:{bilibili:{user:{videoHistory:[missing,id]}}}},{deep:true}),{missing,id});
  await page.waitForFunction(value=>[...document.querySelectorAll('[data-app-id="bilibili"]')].some(e=>e.checkVisibility() && e.innerText.includes(value==='en'?'Video unavailable':'视频已不可用')),{},locale);
  const layout=await page.evaluate(()=>[...document.querySelectorAll('[data-app-id="bilibili"] [data-action="history.item.remove"]')].filter(e=>e.checkVisibility()).map(e=>{const button=e.getBoundingClientRect(),row=e.parentElement.getBoundingClientRect();return button.left>=row.left-1&&button.right<=row.right+1;}));
  assert.equal(layout.length,2); assert.ok(layout.every(Boolean),'remove controls must fit their rows');
  await page.waitForFunction(value=>[...document.querySelectorAll('[data-app-id="bilibili"] [data-history-time]')].some(e=>e.checkVisibility() && e.textContent===(value==='en'?'Viewing time unavailable':'浏览时间未知')),{},locale);
  const removeById=async target=>{
   const control=await page.waitForFunction(value=>[...document.querySelectorAll('[data-app-id="bilibili"] [data-action="history.item.remove"]')].find(e=>e.checkVisibility()&&JSON.parse(e.getAttribute('data-action-params')).videoId===value),{},target);
   await control.click();
   await page.waitForFunction(value=>!window.__SIM__.getState().apps.bilibili.user.videoHistory.includes(value),{},target);
  };
  await removeById(missing);
  assert.deepEqual(await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.videoHistory),[id]);
  await removeById(id);
  assert.equal(await page.evaluate(value=>window.__SIM__.getState().apps.bilibili.user.videoHistorySeenAt?.[value],id),undefined);
  await page.waitForFunction(value=>[...document.querySelectorAll('[data-app-id="bilibili"]')].some(e=>e.checkVisibility() && e.innerText.includes(value==='en'?'No local viewing history':'暂无本地浏览记录')),{},locale);
  assert.deepEqual(errors,[]); checks.push({locale,posture,historyOpens:true,videoOpens:true,missingAndRemove:true,master});
  await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'local simulated video visits only; no real video playback'}));
} finally {await browser.close();}
