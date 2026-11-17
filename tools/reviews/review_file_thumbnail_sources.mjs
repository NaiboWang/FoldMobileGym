// Synthetic solid-color SVGs only; asserts rendered pixels rather than metadata alone.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'),front=['foldmobilegym','mobilegym'].find(p=>fs.existsSync(path.join(root,p,'package.json')));
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath&&fs.existsSync(executablePath));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3432/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const output=fs.mkdtempSync(path.join(root,'artifacts/file-thumbnail-source-')),browser=await require('puppeteer').launch({headless:true,executablePath}),checks=[],failures=[];
const app='[data-app-id="file_manager"]',base='/sdcard/thumbnail-source-synthetic',file=base+'/source.svg',route='/folder?path='+encodeURIComponent(base);
const svg=color=>`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${color}"/></svg>`;
async function pixels(page,row,expected){await page.waitForFunction(({row,expected})=>{const img=document.querySelector(row+' img');if(!img?.complete||!img.naturalWidth)return false;const holder=img.closest('[data-file-image-state]');if(holder&&holder.dataset.fileImageState!=='ready')return false;const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');try{x.drawImage(img,0,0,1,1);const p=x.getImageData(0,0,1,1).data;return p[0]===expected[0]&&p[1]===expected[1]&&p[2]===expected[2];}catch{return false;}},{timeout:3000},{row,expected});}
async function write(page,bytes,target=file){await page.evaluate(async({file,bytes})=>{await window.__SIM_FS__.write(file,bytes,{mimeType:'image/svg+xml'});await window.__SIM_FS__.setMetadata(file,{createdAt:1,modifiedAt:1});},{file:target,bytes});}
try{
 for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en'])for(const scenario of ['rewrite-delete-replace','decode-recovery','caller-browse','caller-recent','caller-category']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[],name=`${posture}-${locale}-${scenario}`;
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((u.origin===url.origin&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SIM_FS__&&window.__OS__&&window.__FOLDAGENT__);
   const basic=scenario.startsWith('caller-'),caseFile=scenario==='caller-browse'?'/sdcard/thumbnail-basic-source.svg':file;
   await write(page,svg('#ff0000'),caseFile);
   if(basic)await page.evaluate(file=>window.__SIM_FS__.setMetadata(file,{modifiedAt:2000000000000}),caseFile);
   const before=await page.evaluate(file=>window.__SIM_FS__.stat(file),caseFile),row=basic?`${app} [data-file-image-node-id="${before.id}"]`:`${app} [data-file-item-id="${before.id}"]`;
   // Hold the real selection snapshot for widget ownership tests. Normal live-list
   // replacement/removal is independently asserted by review_file_list_refresh.mjs.
   const targetRoute=scenario==='caller-browse'?'/':scenario==='caller-recent'?'/recent':scenario==='caller-category'?'/category/images':route+'&mode=select';
   await page.evaluate(({route,posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);window.__OS__.openApp('file_manager',route);},{route:targetRoute,posture,locale});await page.waitForSelector(row,{visible:true});await page.$eval(row,e=>e.scrollIntoView({block:'center'}));await pixels(page,row,[255,0,0]);
   if(basic){
    assert.equal(await page.evaluate(()=>window.scrollY),0,'Thumbnail scroll must remain inside the app');
    assert.equal(await page.evaluate(async file=>(await window.__SIM_FS__.read(file)).text(),caseFile),svg('#ff0000'));
   }else if(scenario==='decode-recovery'){
    await write(page,'X'.repeat(svg('#ff0000').length));await page.waitForSelector(row+' [data-file-image-state="error"]',{timeout:3000});assert.equal(await page.$$eval(row+' img',els=>els.length),0,'Invalid bytes must not leave the old image visible');
    await write(page,svg('#00ff00'));await pixels(page,row,[0,255,0]);
   }else{
    await write(page,svg('#0000ff'));
    const after=await page.evaluate(file=>window.__SIM_FS__.stat(file),file);for(const field of ['id','size','createdAt','modifiedAt'])assert.equal(after[field],before[field]);
    await pixels(page,row,[0,0,255]);
    await page.evaluate(file=>window.__SIM_FS__.delete(file),file);await page.waitForSelector(row+' [data-file-image-state="error"]',{timeout:3000});assert.equal(await page.$$eval(row+' img',els=>els.length),0);
    await write(page,svg('#00ff00'));const replacement=await page.evaluate(file=>window.__SIM_FS__.stat(file),file);assert.notEqual(replacement.id,before.id);
    await page.evaluate(()=>new Promise(r=>setTimeout(r,500)));assert.equal(await page.$$eval(row+' img',els=>els.length),0,'A stale row may not display a replacement node under its old identity');
    await page.evaluate(()=>window.__OS__.openApp('file_manager','/'));await page.waitForFunction(()=>window.__OS__.getAppRoute('file_manager').path==='/');await page.evaluate(route=>window.__OS__.openApp('file_manager',route),route);
    const fresh=`${app} [data-file-item-id="${replacement.id}"]`;await page.waitForSelector(fresh,{visible:true});await pixels(page,fresh,[0,255,0]);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);checks.push(name);console.log('PASS',name);
  }catch(e){failures.push({name,error:String(e.stack)});console.error('FAIL',name,String(e));}finally{await context.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,checks,failures},null,2));}
console.log(JSON.stringify({passed:!failures.length,output,checks,failures}));if(failures.length)process.exitCode=1;
