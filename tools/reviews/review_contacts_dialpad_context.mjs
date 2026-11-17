import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const pkg = new URL('../../foldmobilegym/package.json', import.meta.url);
const require = createRequire(existsSync(pkg) ? pkg : new URL('../../mobilegym/package.json', import.meta.url));
const executablePath=[process.env.FOLDAGENT_BROWSER_PATH,'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/usr/bin/chromium'].filter(Boolean).find(existsSync);
assert.ok(executablePath); const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3400/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const b=await require('puppeteer').launch({headless:true,executablePath}); const checks=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(p,posture='unfolded'){
 await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if ((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
 await p.setViewport({width:1440,height:1100});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__&&window.__SIM__);
 await p.evaluate(posture=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.openApp('contacts','/?dialpad=true');},posture);
 await p.waitForFunction(()=>window.__OS__.getState().activeAppId==='contacts'&&window.__OS__.getAppRoute('contacts')?.path.includes('dialpad=true'));await p.waitForSelector('[data-benchmark-field="dialpad-digits"]',{visible:true});
}
async function digit(p,n){await p.$eval(`[data-action="contacts.dialpad.digit.append"][data-action-params*='"digit":"${n}"']`,e=>e.click());await p.waitForFunction(n=>document.querySelector('[data-benchmark-field="dialpad-digits"]')?.textContent.trim().endsWith(n),{},n);}
async function route(p){return p.evaluate(()=>window.__OS__.getAppRoute('contacts')?.path);}
async function run(name,fn){const c=await b.createBrowserContext();try{const p=await c.newPage();await fn(p);checks.push(name);}catch(e){e.message=`${name}: ${e.message}`;throw e;}finally{await c.close();}}
try {
 await run('typed-number-actions-new-editor-return',async p=>{
  await ready(p); for(const n of ['1','2','3'])await digit(p,n);
  assert.equal(await p.$eval('[data-benchmark-field="dialpad-digits"]',e=>e.textContent.trim()),'123');
  await p.waitForSelector('.contacts-dialpad-unknown',{visible:true});
  const buttons=await p.$$eval('.contacts-dialpad-unknown button',es=>es.map(e=>({text:e.innerText,disabled:e.disabled})));
  assert.deepEqual(buttons.map(x=>x.disabled),[false,false,true,false]);
  await p.click('[data-trigger="dialpad.contact.new"]');await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts')?.path.startsWith('/contacts/new'));
  const number=await p.$eval('[data-contact-field="phone"]',e=>e.value);assert.equal(number,'123');
  await p.evaluate(()=>window.__OS__.handleBack());await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts')?.path.includes('dialpad=true'));
  assert.equal(await p.$eval('[data-benchmark-field="dialpad-digits"]',e=>e.textContent.trim()),'123');
  await p.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await sleep(400);assert.equal(await p.$eval('[data-benchmark-field="dialpad-digits"]',e=>e.textContent.trim()),'123');
  await p.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await p.waitForSelector('.contacts-dialpad-unknown',{visible:true});
 });
 await run('typed-number-sms-intent-and-background-guard',async p=>{
  await ready(p);for(const n of ['1','2','3'])await digit(p,n);const button=await p.$('[data-action="contacts.dialpad.sms.open"]');
  await p.evaluate(()=>window.__OS__.openApp('clock','/'));await p.waitForFunction(()=>window.__OS__.getState().activeAppId==='clock');
  await button.evaluate(e=>e.click());await sleep(150);assert.equal(await p.evaluate(()=>window.__OS__.getState().activeAppId),'clock');
  await p.evaluate(()=>{const s=window.__OS__.getState();window.__OS__.launchTaskById(s.tasks.find(t=>t.rootAppId==='contacts').taskId);});
  await p.waitForFunction(()=>window.__OS__.getState().activeAppId==='contacts');
  await p.evaluate(()=>{const o=window.__OS__,start=o.startActivity;window.__capturedDialIntent=null;o.startActivity=(intent,...rest)=>{window.__capturedDialIntent=intent;return start.call(o,intent,...rest);};});
  await p.click('[data-action="contacts.dialpad.sms.open"]');await p.waitForFunction(()=>window.__capturedDialIntent!==null);
  assert.deepEqual(await p.evaluate(()=>window.__capturedDialIntent),{action:'ACTION_VIEW',scheme:'sms',data:{address:'123'}});
  await p.waitForFunction(()=>window.__OS__.getState().activeAppId==='sms');
 });
 await run('draft-discard-and-save-once',async p=>{
  await ready(p);for(const n of ['1','2','3'])await digit(p,n);
  await p.click('[data-trigger="dialpad.contact.new"]');await p.waitForSelector('[data-contact-field="displayName"]',{visible:true});
  await p.type('[data-contact-field="displayName"]','Synthetic Dialpad');
  await p.evaluate(()=>window.__OS__.handleBack());await p.waitForFunction(()=>!window.__OS__.keyboard.getState().visible);
  await sleep(120);await p.evaluate(()=>window.__OS__.handleBack());await p.waitForSelector('[role="alertdialog"]',{visible:true});
  assert.ok((await route(p)).includes('number=123'));
  await p.click('[data-action="contacts.new.discard.submit"]');await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts')?.path.includes('dialpad=true'));
  assert.equal(await p.$eval('[data-benchmark-field="dialpad-digits"]',e=>e.textContent.trim()),'123');
  assert.equal(await p.evaluate(()=>window.__OS__.content.query('content://contacts/contacts').items.filter(c=>c.displayName==='Synthetic Dialpad').length),0);
  await p.click('[data-trigger="dialpad.contact.new"]');await p.waitForSelector('[data-contact-field="displayName"]',{visible:true});
  await p.type('[data-contact-field="displayName"]','Synthetic Dialpad');await p.click('[data-action="contacts.new.save.submit"]');
  await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts')?.path.includes('dialpad=true'));
  const saved=await p.evaluate(()=>window.__OS__.content.query('content://contacts/contacts').items.filter(c=>c.displayName==='Synthetic Dialpad'));
  assert.equal(saved.length,1);assert.equal(saved[0].phones[0].number,'123');
 });
 await run('same-turn-changed-number-rejects-stale-actions',async p=>{
  await ready(p);for(const n of ['1','2','3'])await digit(p,n);
  await p.evaluate(()=>{const api=window.__OS__,original=api.startActivity;window.__dialIntentCalls=0;api.startActivity=(...args)=>{window.__dialIntentCalls++;return original.apply(api,args);};
   const append=[...document.querySelectorAll('[data-action="contacts.dialpad.digit.append"]')].find(e=>JSON.parse(e.dataset.actionParams).digit==='4');
   const send=document.querySelector('[data-action="contacts.dialpad.sms.open"]');const create=document.querySelector('[data-trigger="dialpad.contact.new"]');
   append.click();send.click();create.click();});
  await p.waitForFunction(()=>document.querySelector('[data-benchmark-field="dialpad-digits"]')?.textContent.trim()==='1234');
  assert.equal(await p.evaluate(()=>window.__dialIntentCalls),0);assert.ok((await route(p)).includes('dialpad=true'));
  assert.equal(await p.$eval('[data-action="contacts.dialpad.sms.open"]',e=>JSON.parse(e.dataset.actionParams).number),'1234');
 });
 await run('rapid-digits-and-backspace',async p=>{
  await ready(p);await p.evaluate(()=>{const a=[...document.querySelectorAll('[data-action="contacts.dialpad.digit.append"]')];for(const n of ['1','2','3'])a.find(e=>JSON.parse(e.dataset.actionParams).digit===n).click();});
  await p.waitForFunction(()=>document.querySelector('[data-benchmark-field="dialpad-digits"]')?.textContent.trim()==='123');
  await p.$eval('.contacts-dialpad-delete-wide',e=>e.click());await p.waitForFunction(()=>document.querySelector('[data-benchmark-field="dialpad-digits"]')?.textContent.trim()==='12');
 });
 console.log(JSON.stringify({passed:true,checks,scope:'Synthetic local data; no real call, message delivery or full native parity asserted.'},null,2));
}finally{await b.close();}
