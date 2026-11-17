// Synthetic manifest responses in an isolated browser; no private reference media.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const frontend=['mobilegym','foldmobilegym'].find(x=>fs.existsSync(path.join(root,x,'package.json')));
const require=createRequire(path.join(root,frontend,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3217/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitRequests(queue, count) { for(let i=0;i<500 && queue.length<count;i++) await sleep(20); assert.ok(queue.length>=count, `Expected ${count} manifest requests, got ${queue.length}`); }
try {
 for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),pending=[],errors=[];let hold=false;
  try {
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||u.origin!==url.origin||u.pathname==='/api'||u.pathname.startsWith('/api/'))return void r.abort();if(hold&&u.pathname==='/cdn/themes/manifest.json')return void pending.push(r);r.continue()});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
   await page.evaluate(({posture,locale})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);window.__OS__.openApp('theme_store','/')},{posture,locale});
   const app='[data-app-id="theme_store"]';await page.waitForSelector(app+' .theme-store-refresh',{visible:true});
   await page.waitForFunction(s=>!document.querySelector(s+' .theme-store-reference-loading'),{},app);
   hold=true;
   await page.click(app+' .theme-store-refresh');
   await waitRequests(pending,1);
   await page.evaluate(s=>document.querySelectorAll(s+' .theme-store-category-rail button')[2].click(),app);
   await waitRequests(pending,2);
   const manifest=(id)=>JSON.stringify({version:1,themes:[{id:'theme-'+id,title:'theme-'+id}],fonts:[{id:'font-'+id,title:'font-'+id}],aod:[]});
   await pending[1].respond({status:200,contentType:'application/json',body:manifest('new')});
   await page.waitForSelector(app+' [data-theme-store-item="font-new"]');
   await pending[0].respond({status:200,contentType:'application/json',body:manifest('old')});
   await sleep(150);
   assert.ok(await page.$(app+' [data-theme-store-item="font-new"]'));
   assert.equal(await page.$(app+' [data-theme-store-item="theme-old"]'),null);
   assert.equal(await page.$(app+' .theme-store-reference-loading'),null);
   // A later refresh also wins over an earlier refresh on the same category.
   await page.click(app+' .theme-store-refresh'); await waitRequests(pending,3);
   await page.click(app+' .theme-store-refresh'); await waitRequests(pending,4);
   await pending[3].respond({status:200,contentType:'application/json',body:manifest('latest')});
   await page.waitForSelector(app+' [data-theme-store-item="font-latest"]');
   await pending[2].respond({status:200,contentType:'application/json',body:manifest('stale')});
   await sleep(150);
   assert.ok(await page.$(app+' [data-theme-store-item="font-latest"]'));
   assert.equal(await page.$(app+' .theme-store-reference-loading'),null);
   // A transient failed refresh retains the last catalog; a later retry can recover.
   await page.click(app+' .theme-store-refresh'); await waitRequests(pending,5);
   await pending[4].respond({status:503,contentType:'text/plain',body:'temporary failure'});
   await page.waitForFunction(s=>!document.querySelector(s+' .theme-store-reference-loading'),{},app);
   assert.ok(await page.$(app+' [data-theme-store-item="font-latest"]'));
   const notice=app+' [data-theme-catalog-status]';
   await page.waitForSelector(notice,{visible:true,timeout:2000});
   assert.equal(await page.$eval(notice,e=>e.textContent.trim()),locale==='en'?'Could not refresh. Showing the last loaded catalog.':'刷新失败，正在显示上次加载的内容。');
   await page.click(app+' .theme-store-refresh'); await waitRequests(pending,6);
   await pending[5].respond({status:200,contentType:'application/json',body:manifest('recovered')});
   await page.waitForSelector(app+' [data-theme-store-item="font-recovered"]');
   assert.equal(await page.$(notice),null);
   assert.deepEqual(errors,[]);console.log('PASS',posture,locale);
  } finally {for(const r of pending)if(!r.isInterceptResolutionHandled())await r.abort().catch(()=>{});await context.close()}
 }
 // Cold failure must not be presented as an ordinary empty catalog. Retry is explicit.
 for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) {
  const context=await browser.createBrowserContext(), page=await context.newPage(), errors=[]; let fail=true;
  try {
   page.on('pageerror',e=>errors.push(e.message)); await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||u.origin!==url.origin||u.pathname==='/api'||u.pathname.startsWith('/api/'))return void r.abort();if(u.pathname==='/cdn/themes/manifest.json')return void r.respond(fail?{status:503,body:'unavailable'}:{status:200,contentType:'application/json',body:JSON.stringify({version:1,themes:[{id:'retry',title:'retry'}],fonts:[],aod:[]})});return void r.continue()});
   await page.setViewport({width:1440,height:1100}); await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
   await page.evaluate(({posture,locale})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);window.__OS__.openApp('theme_store','/')},{posture,locale});
   const app='[data-app-id="theme_store"]', notice=app+' [data-theme-catalog-status]'; await page.waitForSelector(notice,{visible:true});
   assert.equal(await page.$eval(notice,e=>e.textContent.trim()),locale==='en'?'Could not load theme resources. Refresh to retry.':'主题资源加载失败，请点击刷新重试。');
   const bodyText=await page.$eval(app,e=>e.textContent); assert.ok(!bodyText.includes(locale==='en'?'No resources found.':'未发现资源。'));
   fail=false; await page.click(app+' .theme-store-refresh'); await page.waitForSelector(app+' [data-theme-store-item="retry"]');
   assert.equal(await page.$(notice),null); assert.deepEqual(errors,[]); console.log('PASS cold retry',posture,locale);
  } finally {await context.close()}
 }
} finally {await browser.close()}
