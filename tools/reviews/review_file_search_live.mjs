// Isolated synthetic filesystem search; no reference frames or real file operations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const frontend=['mobilegym','foldmobilegym'].find(name=>fs.existsSync(path.join(root,name,'package.json')));
const require=createRequire(path.join(root,frontend,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3217/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath});
const results=[],failures=[];
try {
 for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) for(const mode of ['single','split']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
  try {
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.origin===url.origin&&u.pathname!=='/api'&&!u.pathname.startsWith('/api/'))r.continue();else r.abort()});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__OS__&&window.__SIM_FS__&&window.__FOLDAGENT__);
   await page.evaluate(({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);window.__OS__.openApp('file_manager','/search?q=synthetic-live-qa');},{posture,locale});
   const app='[data-app-id="file_manager"]', row=app+' .fm-search-result';
   await page.waitForSelector(app+' .fm-search-results',{visible:true});
   assert.equal(await page.$$eval(row,els=>els.length),0);
   let otherTask;
   if(mode==='split') {
    const source=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
    await page.evaluate(()=>window.__OS__.openApp('calculator','/'));
    await page.waitForFunction(source=>window.__OS__.getState().activeTaskId!==source,{},source);
    otherTask=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
    await page.evaluate(({source,otherTask})=>window.__FOLDAGENT__.setMultiWindow('split',source,otherTask,.5),{source,otherTask});
    await page.waitForFunction(selector=>document.querySelector(selector)?.checkVisibility(),{},app+' .fm-search-results');
   }
   const base='/sdcard/synthetic-live-qa-a.txt';
   await page.evaluate(async file=>window.__SIM_FS__.write(file,'alpha',{mimeType:'text/plain'}),base);
   await page.waitForFunction(({row})=>[...document.querySelectorAll(row)].some(el=>el.textContent.includes('synthetic-live-qa-a.txt')),{timeout:2500},{row});
   await page.evaluate(async file=>window.__SIM_FS__.write(file,'x'.repeat(4096),{mimeType:'text/plain'}),base);
   await page.waitForFunction(({row})=>[...document.querySelectorAll(row)].some(el=>el.textContent.includes('synthetic-live-qa-a.txt')&&el.textContent.includes('4.0 KB')),{timeout:2500},{row});
   await page.evaluate(async ({from,to})=>window.__SIM_FS__.move(from,to),{from:base,to:'/sdcard/synthetic-live-qa-b.txt'});
   await page.waitForFunction(({row})=>[...document.querySelectorAll(row)].some(el=>el.textContent.includes('synthetic-live-qa-b.txt'))&&![...document.querySelectorAll(row)].some(el=>el.textContent.includes('synthetic-live-qa-a.txt')),{timeout:2500},{row});
   await page.evaluate(async ()=>window.__SIM_FS__.delete('/sdcard/synthetic-live-qa-b.txt'));
   await page.waitForFunction(({row})=>document.querySelectorAll(row).length===0,{timeout:2500},{row});
   assert.equal(await page.$eval(app+' input',e=>e.value),'synthetic-live-qa');
   if(otherTask) assert.equal(await page.evaluate(()=>window.__OS__.getState().activeTaskId),otherTask,'Refresh must not steal focus');
   assert.deepEqual(errors,[]);results.push(`${posture}-${locale}-${mode}`);console.log('PASS',posture,locale,mode);
  } catch(e){failures.push(`${posture}-${locale}-${mode}: ${String(e)}`);console.error('FAIL',posture,locale,mode,String(e))} finally {await context.close()}
 }
} finally {await browser.close()}
console.log(JSON.stringify({results,failures}));if(failures.length)process.exitCode=1;
