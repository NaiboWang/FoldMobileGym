// Actual IndexedDB/Blob URL races, gated only inside disposable synthetic browser profiles.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'),front=['foldmobilegym','mobilegym'].find(p=>fs.existsSync(path.join(root,p,'package.json')));
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath&&fs.existsSync(executablePath));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3432/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output=fs.mkdtempSync(path.join(root,'artifacts/file-uri-cache-')),browser=await require('puppeteer').launch({headless:true,executablePath}),checks=[],failures=[];
const file='/sdcard/uri-cache-synthetic/source.svg';
const svg=label=>`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" data-version="${label}"><rect width="20" height="20" fill="#ff0000"/></svg>`;
try{
 for(const scenario of ['concurrent','rewrite','delete','move','thumbnail']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[];
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((u.origin===url.origin&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM_FS__);
   await page.evaluate(async({file,bytes})=>{await window.__SIM_FS__.write(file,bytes,{mimeType:'image/svg+xml'});await window.__SIM_FS__.setMetadata(file,{createdAt:1,modifiedAt:1});},{file,bytes:svg('ALPHA')});
   if(scenario==='concurrent'){
    const result=await page.evaluate(async file=>{const [a,b]=await Promise.all([window.__SIM_FS__.getUriAsync(file),window.__SIM_FS__.getUriAsync(file)]);return {a,b,bytes:await(await fetch(a)).text()};},file);
    assert.equal(result.a,result.b,'Concurrent same-source loads share one owned URL');assert.equal(result.bytes,svg('ALPHA'));
   }else if(scenario==='thumbnail'){
    await page.evaluate(()=>window.__OS__.openApp('file_manager','/folder?path=%2Fsdcard%2Furi-cache-synthetic'));
    await page.waitForFunction(()=>document.querySelector('[data-app-id="file_manager"] [data-file-item-id] img')?.naturalWidth>0);
    const result=await page.evaluate(async file=>({src:document.querySelector('[data-app-id="file_manager"] [data-file-item-id] img').src,uri:await window.__SIM_FS__.getUriAsync(file)}),file);assert.equal(result.src,result.uri);
   }else{
    const sourceBefore=await page.evaluate(file=>{const {id,size,createdAt,modifiedAt}=window.__SIM_FS__.stat(file);return {id,size,createdAt,modifiedAt};},file);
    // Delay delivery of exactly one completed native read, not the actual IndexedDB transaction or write semantics.
    await page.evaluate(file=>{
     const source=window.__SIM_FS__.stat(file),get=IDBObjectStore.prototype.get,descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'onsuccess');
     if(typeof descriptor?.set!=='function')throw Error('Native IDB success descriptor required');
     IDBObjectStore.prototype.get=function(key){const request=get.call(this,key);if(this.name==='files'&&key===source.id){IDBObjectStore.prototype.get=get;Object.defineProperty(request,'onsuccess',{configurable:true,set(handler){descriptor.set.call(request,event=>{window.__releaseUriRead=()=>handler.call(request,event);window.__uriReadHeld=true;});}});}return request;};
     window.__pendingUri=window.__SIM_FS__.getUriAsync(file);
    },file);
    await page.waitForFunction(()=>window.__uriReadHeld===true);
    if(scenario==='rewrite')await page.evaluate(async({file,bytes})=>{await window.__SIM_FS__.write(file,bytes,{mimeType:'image/svg+xml'});await window.__SIM_FS__.setMetadata(file,{createdAt:1,modifiedAt:1});},{file,bytes:svg('BRAVO')});
    if(scenario==='rewrite'){const sourceAfter=await page.evaluate(file=>{const {id,size,createdAt,modifiedAt}=window.__SIM_FS__.stat(file);return {id,size,createdAt,modifiedAt};},file);assert.deepEqual(sourceAfter,sourceBefore,'The byte rewrite must retain ID, length and timestamps');}
    if(scenario==='delete')await page.evaluate(file=>window.__SIM_FS__.delete(file),file);
    if(scenario==='move'){const moved=await page.evaluate(async file=>{const result=await window.__SIM_FS__.move(file,'/sdcard/uri-cache-synthetic/moved.svg');return {result:!!result,old:window.__SIM_FS__.exists(file),fresh:window.__SIM_FS__.exists('/sdcard/uri-cache-synthetic/moved.svg')};},file);assert.deepEqual(moved,{result:true,old:false,fresh:true},'The source really moved before its pending read completes');}
    const result=await page.evaluate(async()=>{window.__releaseUriRead();return await window.__pendingUri;});
    if(scenario==='rewrite'){
     const truth=await page.evaluate(async file=>{const blob=await window.__SIM_FS__.read(file),uri=await window.__SIM_FS__.getUriAsync(file);return {stored:await blob.text(),cached:await(await fetch(uri)).text()};},file);
     assert.equal(truth.stored,svg('BRAVO'));assert.equal(truth.cached,truth.stored,'A late old read must not poison the fresh-byte cache');
    }
    assert.equal(result,null,`${scenario}: an obsolete pending URI must not be published`);
    if(scenario!=='delete'){
     const target=scenario==='move'?'/sdcard/uri-cache-synthetic/moved.svg':file;
     const bytes=await page.evaluate(async target=>{const uri=await window.__SIM_FS__.getUriAsync(target);return await(await fetch(uri)).text();},target);assert.equal(bytes,svg(scenario==='rewrite'?'BRAVO':'ALPHA'));
    }
   }
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);checks.push(scenario);console.log('PASS',scenario);
  }catch(e){failures.push({scenario,error:String(e.stack)});console.error('FAIL',scenario,String(e));}finally{await context.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,checks,failures},null,2));}
console.log(JSON.stringify({passed:!failures.length,output,checks,failures}));if(failures.length)process.exitCode=1;
