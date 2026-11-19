// Physical pointer checks in disposable synthetic SMS sessions.
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
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output=fs.mkdtempSync(path.join(root,'artifacts/sms-long-press-'));
const browser=await require('puppeteer').launch({headless:true,executablePath}),checks=[],failures=[];
const app='[data-app-id="sms"]',id='hold-0';
const fixture={conversations:Array.from({length:20},(_,i)=>({id:`hold-${i}`,sender:`Synthetic hold ${i}`,phoneNumber:`20255501${String(i).padStart(2,'0')}`,timestamp:'09:00',isUnread:false})),messagesByConversationId:{}};
try{
 for(const posture of ['folded','unfolded'])for(const gesture of ['hold','tap','move','scroll','home','route','right']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[];const name=`${posture}-${gesture}`;
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((u.origin===url.origin&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
   await page.evaluate(async({fixture,posture})=>{window.__FOLDAGENT__.setPosture(posture);await window.__SIM__.preloadAppStores(['sms']);window.__SIM__.setState({os:{providers:{sms:fixture}}},{deep:true});window.__OS__.openApp('sms','/');},{fixture,posture});
   const row=await page.waitForSelector(`${app} [data-conversation-id="${id}"]`,{visible:true});await page.evaluate(()=>new Promise(r=>setTimeout(r,400)));
   const before=await page.evaluate(()=>structuredClone(window.__SIM__.getState().os.providers.sms)),box=await row.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down({button:gesture==='right'?'right':'left'});
   if(gesture==='move')await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2,{steps:4});
   if(gesture==='scroll'){await page.mouse.wheel({deltaY:6});await page.waitForFunction(selector=>document.querySelector(selector).scrollTop>0,{},`${app} [data-scroll-container="master"]`);}
   if(gesture==='home')await page.evaluate(()=>window.__OS__.goHome());
   if(gesture==='route'){await page.evaluate(()=>window.__OS__.openApp('sms','/new?address=2025550199'));await page.waitForSelector(`${app} [data-benchmark-field="sms-body"]`,{visible:true});}
   await page.evaluate(ms=>new Promise(r=>setTimeout(r,ms)),gesture==='tap'?80:650);
   const route=await page.evaluate(()=>window.__OS__.getAppRoute('sms').path),menu=new URLSearchParams(route.split('?')[1]).get('contextMenu');
   assert.equal(menu,gesture==='hold'?id:null,`${name}: only a stationary owned primary hold may open the menu`);
   if(gesture==='route')assert.equal(route,'/new?address=2025550199');
   await page.mouse.up({button:gesture==='right'?'right':'left'});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   if(gesture==='tap')await page.waitForFunction(()=>window.__OS__.getAppRoute('sms').path==='/conversation/hold-0');
   if(['move','scroll'].includes(gesture))assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('sms').path),'/','A drag must not become a conversation tap');
   assert.deepEqual(await page.evaluate(()=>structuredClone(window.__SIM__.getState().os.providers.sms)),before);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   checks.push(name);console.log('PASS',name);
  }catch(e){failures.push({name,error:String(e.stack)});console.error('FAIL',name,String(e));}finally{await context.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,checks,failures},null,2));}
console.log(JSON.stringify({passed:!failures.length,output,checks,failures}));if(failures.length)process.exitCode=1;
