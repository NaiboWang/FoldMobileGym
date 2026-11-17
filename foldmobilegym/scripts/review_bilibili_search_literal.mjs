import {setBilibiliReviewLocale} from './bilibili_review_locale.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});const results=[];
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))return r.abort();return r.continue();});
  await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
  await setBilibiliReviewLocale(page,locale,openPilotApp);
  await openPilotApp(page,'bilibili','/search');await page.waitForSelector('[data-app-id="bilibili"] input',{visible:true});
  for(const query of ['(','[','.*','AI']) {
   const input='[data-app-id="bilibili"] input';await page.click(input);await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type(input,query);await page.keyboard.press('Enter');
   try {
await page.waitForFunction(q=>{const r=window.__OS__.getAppRoute('bilibili')?.path;if(!r)return false;const u=new URL(r,'http://localhost');return u.pathname==='/search/results'&&u.searchParams.get('q')===q;},{timeout:5000},query);
   } catch(error) { console.error(JSON.stringify({locale,posture,query,route:await page.evaluate(()=>window.__OS__.getAppRoute('bilibili')),text:await page.$eval('[data-app-id=\"bilibili\"]',e=>e.innerText.slice(0,250))})); throw error; }
   await page.waitForSelector(input,{visible:true});assert.equal(await page.$eval(input,e=>e.value),query);
   const body=await page.$eval('[data-app-id="bilibili"]',e=>e.innerText);assert.ok(!body.includes('应用出现问题')&&!body.includes('Invalid regular expression'));
  }
  for (const tab of ['user','anime','movie','comprehensive']) {
   const selector=`[data-app-id="bilibili"] [data-trigger="search.results.tab.switch"][data-trigger-params='${JSON.stringify({tab})}']`;
   await page.waitForSelector(selector,{visible:true});await page.click(selector);
   await page.waitForFunction(t=>{const route=window.__OS__.getAppRoute('bilibili')?.path;if(!route)return false;const p=new URL(route,'http://localhost').searchParams;return p.get('tab')===t&&p.get('q')==='AI';},{timeout:5000},tab);
  }
  // Dev-only synthetic in-memory item: it must be displayed as text, not parsed as markup.
  await page.evaluate(async () => {
   // Use the exact Vite-transformed import URL; HMR query strings identify a different module instance.
   const source=await (await fetch('/apps/Bilibili/hooks/useData.ts')).text();
   const match=source.match(/from\s+["'](\/apps\/Bilibili\/data\/loader\.ts[^"']*)["']/);
   if (!match) throw new Error('Cannot identify active Bilibili loader module');
   const loader=await import(match[1]);
   const videos=await loader.loadVideos();
   if (!videos.length) throw new Error('Missing local video fixture');
   videos.unshift({...videos[0],id:'synthetic-search-html-probe',title:'SYNTHETIC_PROBE <img data-synthetic-probe src=x>'});
  });
  const input='[data-app-id="bilibili"] input';await page.click(input);await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type(input,'SYNTHETIC_PROBE');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-app-id="bilibili"] h3')].some(e=>e.textContent.includes('SYNTHETIC_PROBE <img data-synthetic-probe src=x>')));
  assert.equal(await page.$('[data-app-id="bilibili"] h3 img[data-synthetic-probe]'),null,'search title must never render dataset text as HTML');
  assert.deepEqual(errors,[]);results.push({locale,posture,queries:4,syntheticMarkupRenderedAsText:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,results,scope:'dev-only isolated search with synthetic in-memory data; no real service'}));
}finally{await browser.close();}
