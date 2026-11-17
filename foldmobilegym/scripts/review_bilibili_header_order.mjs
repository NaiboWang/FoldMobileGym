import {setBilibiliReviewLocale} from './bilibili_review_locale.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const results=[];
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);page.on('request',request=>{const u=new URL(request.url());if(request.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))return request.abort();return request.continue();});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
  await setBilibiliReviewLocale(page,locale,openPilotApp);
  await openPilotApp(page,'bilibili','/?tab=recommend');await page.waitForSelector('.bili-recommend-grid [data-trigger="video.open"]');
  const geometry=await page.evaluate(()=>{const scope=document.querySelector('[data-app-id="bilibili"]'),toolbar=scope.querySelector('.bili-home-toolbar'),menu=scope.querySelector('[data-trigger="partitions.open"]');const icons=toolbar.querySelectorAll(':scope > svg, :scope > .bili-home-utility > svg');const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {menu:rect(menu),icons:[...icons].map(rect),columns:getComputedStyle(scope.querySelector('.bili-recommend-grid')).gridTemplateColumns.split(' ').length,search:rect(toolbar.querySelector('[data-trigger="search.open"]'))};});
  assert.equal(geometry.icons.length,2);assert.equal(geometry.columns,posture==='unfolded'?3:2);
  assert.ok(geometry.search.right<=geometry.icons[0].left+1,'utility icons must not overlap search');
  if(posture==='unfolded') {assert.ok(geometry.menu.right<=geometry.icons[0].left+1,'expanded: partition menu must precede game and message icons');assert.ok(Math.abs(geometry.menu.top-geometry.icons[0].top)<40,'expanded: toolbar is one row');}
  else assert.ok(geometry.icons[0].bottom<=geometry.menu.top+5,'folded: categories belong on a second row');
  const task=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
  await openPilotApp(page,'clock','/alarm');
  const clock=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
  await page.evaluate(({task,clock})=>window.__FOLDAGENT__.setMultiWindow('split',task,clock,.5),{task,clock});
  await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
  await page.waitForSelector('[data-app-id="bilibili"] .bili-home-utility',{visible:true});
  const compact=await page.$eval('[data-app-id="bilibili"] .bili-home-reference',el=>{
    const search=el.querySelector('[data-trigger="search.open"]').getBoundingClientRect(),utility=el.querySelector('.bili-home-utility').getBoundingClientRect(),menu=el.querySelector('[data-trigger="partitions.open"]').getBoundingClientRect(),bounds=el.getBoundingClientRect();
    return {width:bounds.width,overflow:el.scrollWidth>el.clientWidth+2,searchRight:search.right,utilityLeft:utility.left,menuLeft:menu.left,menuRight:menu.right,boundsLeft:bounds.left,boundsRight:bounds.right};
  });
  assert.equal(compact.overflow,false);assert.ok(compact.searchRight<=compact.utilityLeft+1,'split: search must not overlap utility');assert.ok(compact.menuLeft>=compact.boundsLeft-1&&compact.menuRight<=compact.boundsRight+1,'split: partition menu must remain in app window');
  await page.evaluate(task=>window.__FOLDAGENT__.setMultiWindow('fullscreen',task,null),task);
  await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='fullscreen');
  await openPilotApp(page,'bilibili','/?tab=recommend');
  await page.waitForSelector('[data-app-id="bilibili"] [data-trigger="partitions.open"]',{visible:true});
  await page.click('[data-app-id="bilibili"] [data-trigger="partitions.open"]');await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili').path.startsWith('/partitions'));
  await page.evaluate(()=>window.__OS__.handleBack());await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili').path.startsWith('/?tab=recommend'));
  await page.click('[data-app-id="bilibili"] [data-trigger="search.open"]');await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili').path.startsWith('/search'));
  assert.deepEqual(errors,[]);results.push({locale,posture,columns:geometry.columns,menuAndSearchFunctional:true,splitWindowChecked:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,results,scope:'reference-informed header ordering and navigation, no native-pixel or media-rights claim'}));
} finally {await browser.close();}
