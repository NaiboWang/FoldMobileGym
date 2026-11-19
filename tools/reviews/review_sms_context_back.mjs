// Disposable synthetic SMS menu Back regression. No messages are sent.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const front=['foldmobilegym','mobilegym'].find(p=>fs.existsSync(path.join(root,p,'package.json')));
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath&&fs.existsSync(executablePath));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3432/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath});
const cases=[],failures=[];
const app='[data-app-id="sms"]',id='synthetic-menu-thread';
const fixture={conversations:[{id,sender:'Synthetic menu source',phoneNumber:'2025550101',timestamp:'09:00',isUnread:false}],messagesByConversationId:{[id]:[]}};
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output=fs.mkdtempSync(path.join(root,'artifacts/sms-context-back-'));
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['folded','unfolded'])for(const kind of ['warm-root','routed-root-system','routed-root-backdrop','routed-new-system']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[];
  const name=`${locale}-${posture}-${kind}`;
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((u.origin===url.origin&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
   const parent=kind==='routed-new-system'?'/new?address=2025550199&body=Synthetic+draft':'/';
   const route=kind==='warm-root'?parent:parent+(parent.includes('?')?'&':'?')+`contextMenu=${id}`;
   await page.evaluate(async({route,fixture,locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);await window.__SIM__.preloadAppStores(['sms']);window.__SIM__.setState({os:{providers:{sms:fixture}}},{deep:true});window.__OS__.openApp('sms','/');},{route,fixture,locale,posture});
   await page.waitForSelector(`${app} [data-conversation-id="${id}"]`,{visible:true});
   await page.evaluate(()=>new Promise(r=>setTimeout(r,400)));
   if(kind!=='warm-root')await page.evaluate(route=>window.__OS__.openApp('sms',route),route);
   const menu=`${app} .sms-conversation-list > .absolute.inset-0`;
   if(kind==='warm-root'){
    const row=await page.waitForSelector(`${app} [data-conversation-id="${id}"]`,{visible:true});const box=await row.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.waitForSelector(menu,{visible:true});await page.mouse.up();
   }
   await page.waitForFunction(id=>new URLSearchParams(window.__OS__.getAppRoute('sms').path.split('?')[1]).get('contextMenu')===id,{},id);
   const before=await page.evaluate(()=>{const s=window.__SIM__.getState();return structuredClone({app:s.apps.sms,provider:s.os.providers.sms});});
   if(kind==='routed-root-backdrop'){
    await page.waitForSelector(menu,{visible:true});const box=await page.$eval(menu,e=>{const r=e.getBoundingClientRect(),x=r.x+Math.min(20,r.width*.05),y=r.y+r.height*.2;return {x,y,hittable:document.elementFromPoint(x,y)===e};});assert.ok(box.hittable,'The click must reach the actual backdrop, not the OS status bar');await page.mouse.click(box.x,box.y);
   }else{await page.evaluate(()=>window.__OS__.handleBack());}
   await page.waitForFunction(()=>!new URLSearchParams(window.__OS__.getAppRoute('sms').path.split('?')[1]).has('contextMenu'));
   assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('sms').path),parent,'Only the menu layer closes');
   assert.equal(await page.evaluate(()=>window.__OS__.getState().isLauncherVisible),false,'Back must not leave Messages while closing a menu');
   if(kind==='routed-new-system')assert.equal(await page.$eval(`${app} [data-benchmark-field="sms-body"]`,e=>e.value),'Synthetic draft');
   assert.deepEqual(await page.evaluate(()=>{const s=window.__SIM__.getState();return structuredClone({app:s.apps.sms,provider:s.os.providers.sms});}),before);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   cases.push(name);console.log('PASS',name);
  }catch(e){failures.push({name,error:String(e.stack)});console.error('FAIL',name,String(e));}finally{await context.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,cases,failures},null,2));}
console.log(JSON.stringify({passed:!failures.length,output,cases,failures}));if(failures.length)process.exitCode=1;
