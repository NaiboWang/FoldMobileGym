import {setBilibiliReviewLocale} from './bilibili_review_locale.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});const checks=[];
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))return r.abort();return r.continue();});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
  await setBilibiliReviewLocale(page,locale,openPilotApp);
  await openPilotApp(page,'bilibili','/search');const input='[data-app-id="bilibili"] input';await page.waitForSelector(input,{visible:true});await page.click(input);await page.waitForFunction(()=>window.__OS__.keyboard.isVisible());await page.type(input,'AI');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__OS__.getAppRoute('bilibili')?.path.includes('/search/results'));await page.waitForFunction(()=>!window.__OS__.keyboard.isVisible(),{timeout:5000});
  const app='[data-app-id="bilibili"]',side=`${app} [data-bili-search-side]`,primary=`${app} .bili-search-primary`;await page.waitForSelector(primary);
  if(posture==='unfolded') {
   await page.waitForSelector(side,{visible:true});const dims=await page.evaluate(({app,side,primary})=>{const host=document.querySelector(app).getBoundingClientRect(),a=document.querySelector(primary).getBoundingClientRect(),b=document.querySelector(side).getBoundingClientRect();return {host:host.width,left:a.width,right:b.width,ordered:a.right<=b.left+2,overflow:document.querySelector(app).scrollWidth>document.querySelector(app).clientWidth+2};},{app,side,primary});
   assert.ok(dims.ordered&&!dims.overflow);assert.ok(dims.right/dims.host>.27&&dims.right/dims.host<.40,'sidebar is approximately one third');
   await page.waitForFunction(app=>{const list=document.querySelector(`${app} .bili-search-primary [data-scroll-container="main"]`);return list&&list.scrollHeight>list.clientHeight+200;},{timeout:10000},app);
   const scrolling=await page.evaluate(({app,side})=>{const list=document.querySelector(`${app} .bili-search-primary [data-scroll-container="main"]`),rail=document.querySelector(side);list.scrollTop=180;return {main:list.scrollTop,side:rail.scrollTop};},{app,side});
   assert.ok(scrolling.main>0,'results must remain scrollable');assert.equal(scrolling.side,0,'scrolling results must not scroll the sidebar');
   const sideQuery=await page.$eval(`${side} [data-trigger="search.results.query.submit"]`,el=>JSON.parse(el.getAttribute('data-trigger-params')).q);
   await page.click(`${side} [data-trigger="search.results.query.submit"]`);await page.waitForFunction(q=>{const r=window.__OS__.getAppRoute('bilibili')?.path;if(!r)return false;return new URL(r,'http://localhost').searchParams.get('q')===q;},{timeout:5000},sideQuery);
   assert.equal(await page.$eval(input,el=>el.value),sideQuery);assert.equal(await page.evaluate(()=>window.__OS__.keyboard.isVisible()),false);
   await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await page.waitForFunction(s=>{const e=document.querySelector(s);return e&&getComputedStyle(e).display==='none';},{timeout:5000},side);assert.equal(new URL(await page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path),'http://localhost').searchParams.get('q'),sideQuery);
  } else {const shown=await page.$eval(side,el=>getComputedStyle(el).display!=='none');assert.equal(shown,false);}
  await page.click(input);await page.waitForFunction(()=>window.__OS__.keyboard.isVisible());await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.type(input,'AI');
  await page.click(`${primary} [data-trigger="search.results.query.submit"]`);
  await page.waitForFunction(()=>{const r=window.__OS__.getAppRoute('bilibili')?.path;return r&&new URL(r,'http://localhost').searchParams.get('q')==='AI'&&!window.__OS__.keyboard.isVisible();},{timeout:5000});
  // A new query with a long result set must not inherit a previous query's scroll offset.
  const resultsScroll=`${primary} [data-scroll-container="main"]`;
  await page.waitForFunction(selector=>{const n=document.querySelector(selector);return n&&n.scrollHeight>n.clientHeight+600;},{timeout:10000},resultsScroll);
  const previousOffset=await page.$eval(resultsScroll,el=>{el.scrollTop=400;return el.scrollTop;});assert.ok(previousOffset>200);
  await page.click(input);await page.waitForFunction(()=>window.__OS__.keyboard.isVisible());
  await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.type(input,'a');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const r=window.__OS__.getAppRoute('bilibili')?.path;return r&&new URL(r,'http://localhost').searchParams.get('q')==='a'&&!window.__OS__.keyboard.isVisible();},{timeout:5000});
  await page.waitForFunction(selector=>{const n=document.querySelector(selector);return n&&n.scrollHeight>n.clientHeight+600;},{timeout:10000},resultsScroll);
  assert.equal(await page.$eval(resultsScroll,el=>el.scrollTop),0,'new query must start at the top of its own results');
  await page.click(input);await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.type(input,'AI');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>{const r=window.__OS__.getAppRoute('bilibili')?.path;return r&&new URL(r,'http://localhost').searchParams.get('q')==='AI'&&!window.__OS__.keyboard.isVisible();},{timeout:5000});
  const biliTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);await openPilotApp(page,'clock','/alarm');const clockTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
  await page.evaluate(({biliTask,clockTask})=>window.__FOLDAGENT__.setMultiWindow('split',biliTask,clockTask,.5),{biliTask,clockTask});
  await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
  await page.waitForFunction(s=>{const e=document.querySelector(s);return e&&getComputedStyle(e).display==='none';},{timeout:5000},side);
  const split=await page.$eval(`${app} .bili-search-reference`,el=>({overflow:el.scrollWidth>el.clientWidth+2,query:el.querySelector('input')?.value}));assert.equal(split.overflow,false);assert.equal(split.query,'AI');
  assert.deepEqual(errors,[]);checks.push({locale,posture,keyboardDismissed:true,sidebar:posture==='unfolded',navigation:true,splitPreserved:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'local simulated search; recorded layout reference only, not live search or complete native parity'}));
}finally{await browser.close();}
