// Isolated synthetic files only. Does not read or modify the host filesystem.
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const front=['foldmobilegym','mobilegym'].find(p=>fs.existsSync(path.join(root,p,'package.json')));
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath&&fs.existsSync(executablePath));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3432/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath}),checks=[],failures=[];
const output=fs.mkdtempSync(path.join(root,'artifacts/file-preview-source-')),app='[data-app-id="file_manager"]';
try{
 for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en'])for(const type of ['text','pdf']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[];const name=`${posture}-${locale}-${type}`;
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((u.origin===url.origin&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM_FS__&&window.__FOLDAGENT__);
   const filename=`/sdcard/preview-source-synthetic/source.${type==='pdf'?'pdf':'txt'}`;
   const payload=text=>type==='pdf'?`%PDF-1.4\n1 0 obj <</Length 50>> stream\nBT (Preview_${text}) Tj ET\nendstream endobj\n%%EOF`: `Preview_${text}`;
   await page.evaluate(async({filename,payload,posture,locale,type})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);await window.__SIM_FS__.write(filename,payload,{mimeType:type==='pdf'?'application/pdf':'text/plain'});await window.__SIM_FS__.setMetadata(filename,{createdAt:1,modifiedAt:1});window.__OS__.openApp('file_manager',`/${type}?path=${encodeURIComponent(filename)}`);},{filename,payload:payload('ALPHA'),posture,locale,type});
   const main=`${app} [data-scroll-container="main"]`;
   await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('Preview_ALPHA'),{},main);
   const source=await page.evaluate(filename=>window.__SIM_FS__.stat(filename),filename);
   await page.evaluate(async({filename,payload,type})=>{await window.__SIM_FS__.write(filename,payload,{mimeType:type==='pdf'?'application/pdf':'text/plain'});await window.__SIM_FS__.setMetadata(filename,{createdAt:1,modifiedAt:1});},{filename,payload:payload('BRAVO'),type});
   const rewritten=await page.evaluate(filename=>window.__SIM_FS__.stat(filename),filename);assert.equal(rewritten.id,source.id);assert.equal(rewritten.size,source.size);assert.equal(rewritten.modifiedAt,source.modifiedAt);
   await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('Preview_BRAVO'),{timeout:3000},main);
   assert.ok(!(await page.$eval(main,e=>e.textContent)).includes('Preview_ALPHA'));
   await page.evaluate(async filename=>{await window.__SIM_FS__.delete(filename);},filename);
   await page.waitForSelector(`${app} [data-file-preview-state="error"]`,{timeout:3000});assert.ok(!(await page.$eval(main,e=>e.textContent)).includes('Preview_BRAVO'));
   await page.evaluate(async({filename,payload,type})=>{await window.__SIM_FS__.write(filename,payload,{mimeType:type==='pdf'?'application/pdf':'text/plain'});},{filename,payload:payload('CHARL'),type});
   const replacement=await page.evaluate(filename=>window.__SIM_FS__.stat(filename),filename);assert.notEqual(replacement.id,source.id);
   await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('Preview_CHARL'),{timeout:3000},main);
   await page.evaluate(()=>window.__FOLDAGENT__.setPosture(window.__FOLDAGENT__.getState().posture==='folded'?'unfolded':'folded'));
   assert.ok((await page.$eval(main,e=>e.textContent)).includes('Preview_CHARL'));
   assert.equal(await page.evaluate(filename=>window.__OS__.getAppRoute('file_manager').path,filename),`/${type}?path=${encodeURIComponent(filename)}`);
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);checks.push(name);console.log('PASS',name);
  }catch(e){failures.push({name,error:String(e.stack)});console.error('FAIL',name,String(e));}finally{await context.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,checks,failures},null,2));}
console.log(JSON.stringify({passed:!failures.length,output,checks,failures}));if(failures.length)process.exitCode=1;
