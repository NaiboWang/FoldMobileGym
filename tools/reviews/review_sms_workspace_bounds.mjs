// Synthetic local-browser regression; never sends an SMS or contacts external services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(import.meta.dirname, '../..');
const front = ['foldmobilegym', 'mobilegym'].find(name => fs.existsSync(path.join(root, name, 'package.json')));
assert.ok(front, 'Frontend package required');
const require = createRequire(path.join(root, front, 'package.json'));
const executablePath = process.env.FOLDAGENT_BROWSER_PATH || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath && fs.existsSync(executablePath));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3432/');
assert.ok(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const output = path.join(root, 'artifacts', `sms-workspace-bounds-${process.env.FOLDAGENT_REVIEW_LABEL || 'review'}-${process.pid}`);
fs.mkdirSync(output, {recursive:true});
const app = '[data-app-id="sms"]', body = `${app} [data-benchmark-field="sms-body"]`;
const fixture = {conversations:[
  {id:'synthetic-a',sender:'Synthetic Alpha',phoneNumber:'2025550101',timestamp:'09:00',isUnread:false},
  {id:'synthetic-b',sender:'Synthetic Beta',phoneNumber:'2025550102',timestamp:'09:01',isUnread:false}
],messagesByConversationId:{'synthetic-a':[{id:'message-a',content:'Synthetic alpha message',timestamp:'09:00',isOutgoing:false}],'synthetic-b':[]}};
const browser = await require('puppeteer').launch({headless:true,executablePath});
const results=[],failures=[];
async function geometry(page) {
  return page.$eval(`${app} .sms-workspace`, e=>{
    const grid=e.querySelector('[data-sms-workspace]'),m=e.querySelector('[data-sms-master-pane]'),d=e.querySelector('[data-sms-detail-pane]');
    const rect=x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
    return {outer:rect(e),master:rect(m),detail:rect(d),masterDisplay:getComputedStyle(m).display,detailDisplay:getComputedStyle(d).display,scroll:grid.scrollWidth,width:grid.clientWidth};
  });
}
async function assertLayout(page,name) {
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const g=await geometry(page),wide=g.outer.width>=600;
  assert.ok(g.scroll<=g.width+1,`${name}: no outer overflow`);
  if(wide){
    assert.notEqual(g.masterDisplay,'none');assert.notEqual(g.detailDisplay,'none');
    assert.ok(Math.abs(g.master.width-g.outer.width*.4)<=1,`${name}: master must be 40%, got ${g.master.width}/${g.outer.width}`);
    assert.ok(Math.abs(g.detail.width-g.outer.width*.6)<=1,`${name}: detail must be 60%`);
    assert.ok(g.detail.right<=g.outer.right+1 && g.detail.left>=g.master.right-1,`${name}: panes contained`);
  }else{assert.equal(g.masterDisplay,'none');assert.ok(Math.abs(g.detail.width-g.outer.width)<=1);}
  results.push({name,...g});
}
try {
 for(const locale of ['zh-Hans','en']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[];
  try {
   page.on('pageerror',e=>errors.push(e.message));
   await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((u.origin===url.origin && ['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__SIM__&&window.__OS__&&window.__FOLDAGENT__);
   await page.evaluate(async ({locale,fixture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture('unfolded');await window.__SIM__.preloadAppStores(['sms']);window.__SIM__.setState({os:{providers:{sms:fixture}}},{deep:true});window.__OS__.openApp('sms','/');},{locale,fixture});
   await page.waitForSelector(`${app} [data-conversation-id="synthetic-b"]`,{visible:true});
   assert.equal(await page.$$eval(`${app} [data-conversation-id][data-selected]`,els=>els.length),0,'An empty detail must not claim a selected conversation');
   await page.click(`${app} [data-trigger="compose.open"]`);
   await page.waitForSelector(body,{visible:true});
   assert.equal(await page.$$eval(`${app} [data-conversation-id][data-selected]`,els=>els.length),0,'A new draft must not highlight an unrelated conversation');
   await assertLayout(page,`${locale}-full`);
   const fullWidth=(await geometry(page)).outer.width;
   await page.click(body);await page.keyboard.type('Synthetic draft');await page.evaluate(()=>window.__OS__.keyboard.hide());
   const before=await page.evaluate(()=>structuredClone(window.__SIM__.getState().apps.sms));
   for(const width of [.75,.735,.70]){
    await page.evaluate(width=>window.__FOLDAGENT__.setFloatingWindow(window.__OS__.getState().activeTaskId,{x:.1,y:.1,width,height:.7}),width);
    await page.waitForFunction(({width,fullWidth})=>Math.abs(document.querySelector('[data-app-id="sms"] .sms-workspace').clientWidth-(fullWidth*width-2))<3,{},{width,fullWidth});
    await assertLayout(page,`${locale}-floating-${width}`);
    assert.equal(await page.$eval(body,e=>e.value),'Synthetic draft');
   }
   await page.evaluate(()=>window.__FOLDAGENT__.setMultiWindow('fullscreen'));
   await page.waitForFunction(()=>document.querySelector('[data-app-id="sms"] .sms-workspace').clientWidth>800);
   await page.click(`${app} [data-conversation-id="synthetic-b"]`);
   await page.waitForFunction(()=>window.__OS__.getAppRoute('sms').path==='/conversation/synthetic-b');
   assert.deepEqual(await page.$$eval(`${app} [data-conversation-id][data-selected]`,els=>els.map(e=>e.dataset.conversationId)),['synthetic-b']);
   await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(body,{visible:true});
   assert.equal(await page.$eval(body,e=>e.value),'Synthetic draft');
   assert.equal(await page.$$eval(`${app} [data-conversation-id][data-selected]`,els=>els.length),0);
   await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-app-id="sms"] [data-sms-master-pane]')).display==='none');
   await assertLayout(page,`${locale}-folded`);assert.equal(await page.$eval(body,e=>e.value),'Synthetic draft');
   await page.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-app-id="sms"] [data-sms-master-pane]')).display!=='none');
   await page.click(`${app} [data-trigger="compose.contacts.open"]`);await page.waitForSelector(`${app} .sms-contact-picker`,{visible:true});
   const picker=await geometry(page);assert.equal(picker.masterDisplay,'none');assert.ok(Math.abs(picker.detail.width-picker.outer.width)<=1);
   await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(body,{visible:true});
   assert.deepEqual(await page.evaluate(()=>structuredClone(window.__SIM__.getState().apps.sms)),before,'Draft/layout operations do not change messages or drafts');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   await page.screenshot({path:path.join(output,`${locale}-synthetic.png`)});console.log('PASS',locale);
  }catch(e){failures.push({locale,error:String(e.stack)});console.error('FAIL',locale,String(e));}finally{await context.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,results,failures},null,2));}
console.log(JSON.stringify({passed:!failures.length,output,results:results.length,failures}));if(failures.length)process.exitCode=1;
