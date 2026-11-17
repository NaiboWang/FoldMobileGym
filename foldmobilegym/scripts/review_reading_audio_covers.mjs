import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const require=createRequire(path.resolve(import.meta.dirname,'../package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}), checks=[];
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))return r.abort();return r.continue();});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
  await openPilotApp(page,'wechat_reading','/');await page.click('[data-app-id="wechat_reading"] [data-trigger="tab.audiobooks"]');
  const grid='[data-app-id="wechat_reading"] .wr-audio-recommend-grid';await page.waitForSelector(grid+' > div', {visible:true});
  const measure=async()=>page.$eval(grid,el=>{const box=el.firstElementChild.firstElementChild.getBoundingClientRect();return {ratio:box.width/box.height,count:el.children.length,overflow:el.scrollWidth>el.clientWidth+2};});
  const before=await measure();assert.ok(before.count>0&&!before.overflow);assert.ok(Math.abs(before.ratio-(posture==='unfolded'?1:.75))<.03,`unexpected ${posture} cover ratio ${before.ratio}`);
  const ids=async()=>page.$$eval(grid+' > div',els=>els.map(el=>JSON.parse(el.getAttribute('data-trigger-params')).bookId));
  await page.evaluate(()=>{Math.random=()=>0.5;});
  const previous=await ids();await page.click('[data-app-id="wechat_reading"] [data-action="audiobooks.recommendations.refresh.submit"]');
  const first=await ids();assert.ok(first.every(id=>!previous.includes(id)),'refresh should replace all entries when enough alternatives exist');
  await page.click('[data-app-id="wechat_reading"] [data-action="audiobooks.recommendations.refresh.submit"]');
  const second=await ids();assert.ok(second.every(id=>!first.includes(id)),'successive refresh should replace entries even with identical random values');
  const after=await measure();assert.ok(after.count>0&&!after.overflow);assert.ok(Math.abs(after.ratio-before.ratio)<.03);
  await page.click(grid+' > div');await page.waitForFunction(()=>window.__OS__.getAppRoute('wechat_reading')?.path.includes('/book/'),{timeout:5000});
  const readButton='[data-app-id="wechat_reading"] [data-reading-book-read]';
  const audioRead=await page.$eval(readButton,el=>({disabled:el.disabled,text:el.textContent.trim(),opacity:Number(getComputedStyle(el).opacity)}));assert.equal(audioRead.disabled,true);assert.ok(audioRead.opacity<1);assert.equal(audioRead.text,locale==='en'?'Audio unavailable':'有声播放暂不可用');
  await openPilotApp(page,'wechat_reading','/book/1');const regularRead=await page.$eval(readButton,el=>({disabled:el.disabled,text:el.textContent.trim()}));assert.equal(regularRead.disabled,false);assert.equal(regularRead.text,locale==='en'?'Read':'阅读');await page.click(readButton);await page.waitForFunction(()=>window.__OS__.getAppRoute('wechat_reading')?.path.startsWith('/read/1'),{timeout:5000});
  await openPilotApp(page,'wechat_reading','/audiobooks?sub=audio');await page.waitForSelector(grid+' > div', {visible:true});
  if(posture==='unfolded') {
   const readingTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);await openPilotApp(page,'clock','/alarm');const clockTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
   await page.evaluate(({readingTask,clockTask})=>window.__FOLDAGENT__.setMultiWindow('split',readingTask,clockTask,.5),{readingTask,clockTask});
   await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
   const split=await measure();assert.ok(!split.overflow&&Math.abs(split.ratio-.75)<.03,'narrow split keeps compact cover geometry');
   await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await page.waitForFunction(()=>window.__FOLDAGENT__.getState().posture==='folded');
   assert.ok((await page.evaluate(()=>window.__OS__.getAppRoute('wechat_reading')?.path)).startsWith('/audiobooks'));
   assert.deepEqual(errors,[]);await context.close();checks.push({locale,posture,coverRatio:before.ratio,refresh:true,detail:true,split:true});continue;
  }
  assert.deepEqual(errors,[]);checks.push({locale,posture,coverRatio:before.ratio,refresh:true,detail:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'local synthetic audiobooks; covers, refresh and disabled audio detail'}));
} finally {await browser.close();}
