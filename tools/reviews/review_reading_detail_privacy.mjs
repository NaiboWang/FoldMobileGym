// Local-only, disposable profiles. Operate on existing shelf records through UI;
// no source/default/task edits and no real WeChat account privacy changes.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const output=fs.mkdtempSync(path.join(root,'artifacts/reading-detail-privacy-')),browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const app='[data-app-id="wechat_reading"]',action=`${app} [data-action="bookDetail.item.privacy.submit"]`;
const errors=[],checks=[],failures=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
const state=p=>p.evaluate(()=>window.__SIM__.getState().apps.wechat_reading);
const route=p=>p.evaluate(()=>window.__OS__.getAppRoute('wechat_reading').path);
const withoutPrivacy=s=>{const {shelf,homeFinishedBookIds,...rest}=s;return rest;};
async function start(p,locale='zh-Hans',posture='unfolded'){
 p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1440,height:1100});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await p.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
 await openPilotApp(p,'wechat_reading','/bookshelf');const before=await state(p);const publicItems=before.shelf.filter(i=>i.isPrivate===false).slice(0,3);const item=publicItems.find(i=>before.finishedBookIds.includes(i.bookId))??publicItems[0];assert.ok(item,'Need an existing public record, not a synthesized replacement');return{before,id:item.bookId,owner:'/book/'+encodeURIComponent(item.bookId)};
}
async function menu(p,owner){await openPilotApp(p,'wechat_reading',owner);await p.click(`${app} [data-trigger="book.modal.shelf.open"]`);await p.waitForSelector(`${app} [data-action="bookDetail.item.shelf.remove.submit"]`,{visible:true});}
async function visibleBook(p,id,trigger){return p.$$eval(`${app} [data-trigger="${trigger}"]`,(es,id)=>es.some(e=>e.checkVisibility()&&JSON.parse(e.dataset.triggerParams||'{}').bookId===id),id);}
async function hitClick(p,selector){
 await p.waitForFunction(async selector=>{const e=[...document.querySelectorAll(selector)].find(e=>e.checkVisibility());if(!e)return false;const a=e.getBoundingClientRect();await new Promise(r=>requestAnimationFrame(r));const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return e.isConnected&&Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5&&Math.abs(a.width-b.width)<.5&&Math.abs(a.height-b.height)<.5&&(hit===e||e.contains(hit));},{},selector);
 const targets=await p.$$(selector);try{for(const target of targets)if(await target.evaluate(e=>e.checkVisibility())){await target.click();return;}throw Error('No visible control: '+selector);}finally{for(const target of targets)await target.dispose();}
}
async function submit(p,id,value){assert.deepEqual(await p.$eval(action,e=>JSON.parse(e.dataset.actionParams)),{bookId:id,isPrivate:value});await hitClick(p,action);await p.waitForFunction(({id,value})=>window.__SIM__.getState().apps.wechat_reading.shelf.find(i=>i.bookId===id)?.isPrivate===value,{}, {id,value});await p.waitForSelector(action,{hidden:true});}
async function run(name,fn){const c=await browser.createBrowserContext(),p=await c.newPage();try{await fn(p);checks.push(name);}catch(e){failures.push({name,error:String(e.stack),route:await route(p).catch(()=>null)});await p.screenshot({path:path.join(output,name+'-failure.png')}).catch(()=>{});}finally{await c.close();}}
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['unfolded','folded'])await run(locale+'-'+posture,async p=>{
  const {before,id,owner}=await start(p,locale,posture);await menu(p,owner);
  const label=locale==='en'?'Private Reading':'私密阅读';assert.equal(await p.$$eval(`${app} button`,(es,label)=>es.find(e=>e.checkVisibility()&&e.textContent.trim()===label)?.disabled,label),false,'Detail privacy action must be connected, not a disabled placeholder');
  const dialog=`${app} [role="dialog"]`;await p.waitForSelector(dialog,{visible:true});assert.ok(await p.$eval(dialog,e=>e.contains(document.activeElement)));
  assert.equal(await p.$eval(`${app} [data-reading-book-detail]>div:first-child`,e=>e.inert),true);
  for(let i=0;i<5;i++){await p.keyboard.press('Tab');assert.ok(await p.$eval(dialog,e=>e.contains(document.activeElement)));}await p.keyboard.down('Shift');await p.keyboard.press('Tab');await p.keyboard.up('Shift');assert.ok(await p.$eval(dialog,e=>e.contains(document.activeElement)));
  await submit(p,id,true);assert.equal(await route(p),owner);assert.ok(await p.$eval(`${app} [data-trigger="book.modal.shelf.open"]`,e=>e===document.activeElement),'Detail menu restores its opener focus');
  const hidden=await state(p);assert.deepEqual(hidden.shelf,before.shelf.map(e=>e.bookId===id?{...e,isPrivate:true}:e));assert.deepEqual(withoutPrivacy(hidden),withoutPrivacy(before),'Only the selected shelf flag may change');
  await openPilotApp(p,'wechat_reading','/my-profile?tab=shelf');assert.equal(await visibleBook(p,id,'book.detail.open'),false,'Private book is absent from the public profile card');assert.equal(await p.$eval(`${app} [data-reading-public-count]`,e=>Number(e.dataset.readingPublicCount)),before.shelf.filter(e=>e.isPrivate===false).length-1,'Public summary is derived from actual public records, not a fabricated private-book activity');
  await openPilotApp(p,'wechat_reading','/user/'+encodeURIComponent(before.user.id)+'/shelf');assert.equal(await visibleBook(p,id,'book.detail.open'),false,'Private book is absent from public user shelf');
  await openPilotApp(p,'wechat_reading','/user/'+encodeURIComponent(before.user.id));assert.equal(await visibleBook(p,id,'book.detail.open'),false,'The current-user profile alias also excludes the private book');
  await openPilotApp(p,'wechat_reading','/bookshelf');assert.equal(await visibleBook(p,id,'reader.open'),true,'Own shelf retains the private book');
  if(before.finishedBookIds.includes(id))assert.ok(!(await state(p)).homeFinishedBookIds.includes(id));
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__SIM__);await openPilotApp(p,'wechat_reading',owner);assert.equal((await state(p)).shelf.find(e=>e.bookId===id).isPrivate,true,'Private flag survives a fresh page');
  await menu(p,owner);assert.ok(await p.$eval(action,e=>e.textContent.includes('Public')||e.textContent.includes('公开')));await p.keyboard.press('Escape');await p.waitForSelector(action,{hidden:true});assert.equal((await state(p)).shelf.find(e=>e.bookId===id).isPrivate,true);assert.equal(await route(p),owner);await menu(p,owner);
  await p.evaluate(pose=>window.__FOLDAGENT__.setPosture(pose),posture==='folded'?'unfolded':'folded');await p.waitForSelector(action,{visible:true});await submit(p,id,false);assert.equal(await route(p),owner);
  assert.deepEqual((await state(p)).shelf,before.shelf,'Restoring public does not replace records, reorder the shelf or lose addedAt');
  await openPilotApp(p,'wechat_reading','/my-profile?tab=shelf');assert.equal(await visibleBook(p,id,'book.detail.open'),true);assert.equal(await p.$eval(`${app} [data-reading-public-count]`,e=>Number(e.dataset.readingPublicCount)),before.shelf.filter(e=>e.isPrivate===false).length);
  await openPilotApp(p,'wechat_reading','/user/'+encodeURIComponent(before.user.id)+'/shelf');assert.equal(await visibleBook(p,id,'book.detail.open'),true);
  await openPilotApp(p,'wechat_reading','/user/'+encodeURIComponent(before.user.id));assert.equal(await visibleBook(p,id,'book.detail.open'),true);
  assert.deepEqual(withoutPrivacy(await state(p)),withoutPrivacy(before));await p.screenshot({path:path.join(output,locale+'-'+posture+'-public.png')});
 });
 await run('background-and-stale-source-callbacks',async p=>{
  const {before,id,owner}=await start(p);await menu(p,owner);await p.evaluate(action=>window.__privacyOld=document.querySelector(action),action);await openPilotApp(p,'clock','/alarm/new');await p.evaluate(()=>window.__privacyOld.click());assert.deepEqual(await state(p),before);assert.equal(await p.evaluate(()=>window.__OS__.getAppRoute('clock').path),'/alarm/new');
  await openPilotApp(p,'wechat_reading',owner+'?modal=shelf');await p.waitForSelector(action,{visible:true});
  // A concurrent replacement is only a disposable scenario input. The stale
  // rendered callback must not override the newly supplied shelf record.
  const edited=before.shelf.map(e=>e.bookId===id?{...e,addedAt:'2026-01-01T00:00:00.000Z'}:e);
  await p.evaluate(({action,edited})=>{const button=document.querySelector(action);window.__SIM__.setState({apps:{wechat_reading:{shelf:edited}}});button.click();},{action,edited});assert.deepEqual((await state(p)).shelf,edited,'A stale source callback cannot change the new shelf record');assert.ok((await route(p)).includes('modal=shelf'));
  await p.click(`${app} [data-reading-book-cancel]`);await menu(p,owner);await submit(p,id,true);assert.deepEqual((await state(p)).shelf,edited.map(e=>e.bookId===id?{...e,isPrivate:true}:e));
 });
 await run('same-frame-idempotence-and-cold-owner',async p=>{
  const {before,id,owner}=await start(p);await menu(p,owner);await p.$eval(action,e=>{e.click();e.click();});await p.waitForSelector(action,{hidden:true});assert.equal(await route(p),owner);assert.deepEqual((await state(p)).shelf,before.shelf.map(e=>e.bookId===id?{...e,isPrivate:true}:e));
  await openPilotApp(p,'wechat_reading',owner+'?trace=keep&modal=shelf');await p.waitForSelector(action,{visible:true});await submit(p,id,false);assert.equal(await route(p),owner+'?trace=keep');assert.deepEqual((await state(p)).shelf,before.shelf);
 });
 await run('real-short-split-menu',async p=>{
  const {before,id,owner}=await start(p);await menu(p,owner);
  const bar=await(await p.$('[data-gesture-bar]')).boundingBox();await p.mouse.move(bar.x+bar.width/2,bar.y+bar.height-4);await p.mouse.down();await p.mouse.move(bar.x+bar.width*.22,bar.y-240,{steps:12});await p.mouse.up();const picker='[data-window-picker="split"]';await p.waitForSelector(picker,{visible:true});await p.click(`${picker} [data-launcher-app="clock"]`);await p.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
  await p.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await p.waitForSelector('[data-app-id="clock"] .clock-app-root',{visible:true});await p.waitForFunction(app=>{const a=document.querySelector(app).getBoundingClientRect(),b=document.querySelector('[data-app-id="clock"]').getBoundingClientRect();return Math.abs(a.y+a.height-b.y)<2;},{},app);
  const divider=await(await p.$('.foldagent-split-divider')).boundingBox();await p.mouse.move(divider.x+divider.width/2,divider.y+divider.height/2);await p.mouse.down();await p.mouse.move(divider.x+divider.width/2,divider.y-130,{steps:10});await p.mouse.up();await wait(160);
  const geometry=await p.$eval(action,e=>{const a=e.getBoundingClientRect(),b=e.closest('[data-app-id]').getBoundingClientRect(),hit=document.elementFromPoint(a.x+a.width/2,a.y+a.height/2);return{row:{x:a.x,y:a.y,right:a.right,bottom:a.bottom},pane:{x:b.x,y:b.y,right:b.right,bottom:b.bottom},hit:e===hit||e.contains(hit)};});fs.writeFileSync(path.join(output,'split-menu-geometry.json'),JSON.stringify(geometry,null,2));assert.ok(geometry.hit&&geometry.row.y>=geometry.pane.y&&geometry.row.bottom<=geometry.pane.bottom,'Privacy action is inside and hit-testable in its own short pane');
  const menuBox=await(await p.$(`${app} [role="dialog"]`)).boundingBox();assert.ok(await p.$eval(`${app} [role="dialog"]`,e=>e.scrollHeight>e.clientHeight),'The genuinely short menu has a scroll owner');
  await p.mouse.move(menuBox.x+menuBox.width/2,menuBox.y+menuBox.height/2);await p.mouse.wheel({deltaY:300});await wait(120);
  const cancelHit=await p.$eval(`${app} [data-reading-book-cancel]`,e=>{const r=e.getBoundingClientRect(),m=e.closest('[role="dialog"]').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.y>=m.y&&r.bottom<=m.bottom+1&&(hit===e||e.contains(hit));});assert.ok(cancelHit,'Real wheel exposes an actually hit-testable Cancel, not an offscreen programmatic click');
  await p.mouse.wheel({deltaY:-300});await wait(120);
  await hitClick(p,'[data-app-id="clock"] [data-trigger="tab.world"]');await p.waitForFunction(()=>window.__OS__.getAppRoute('clock')?.path==='/world');
  await submit(p,id,true);assert.equal(await route(p),owner);assert.equal(await p.evaluate(()=>window.__OS__.getAppRoute('clock').path),'/world');assert.deepEqual((await state(p)).shelf,before.shelf.map(e=>e.bookId===id?{...e,isPrivate:true}:e));await p.screenshot({path:path.join(output,'folded-private-split.png')});
 });
 await run('existing-shelf-dialog-focus-regression',async p=>{
  const {before,id}=await start(p);const selector=`${app} [data-shelf-book-id="${id}"]`;
  const item=await(await p.$(selector)).boundingBox();await p.mouse.move(item.x+item.width/2,item.y+item.height/2);await p.mouse.down();await wait(680);await p.mouse.up();await p.waitForFunction(()=>window.__OS__.getAppRoute('wechat_reading').path.includes('select=true'));
  await hitClick(p,`${app} [data-trigger="bookshelf.modal.private.open"]`);const dialog=`${app} [role="dialog"]`;await p.waitForSelector(dialog,{visible:true});assert.ok(await p.$eval(`${dialog} [data-trigger="system.back"]`,e=>e===document.activeElement),'Existing shelf confirmation still initially focuses Cancel');
  for(let i=0;i<3;i++){await p.keyboard.press('Tab');assert.ok(await p.$eval(dialog,e=>e.contains(document.activeElement)));}
  await p.click(`${dialog} [data-trigger="system.back"]`);await p.waitForSelector(dialog,{hidden:true});assert.deepEqual((await state(p)).shelf,before.shelf);assert.ok(await p.$eval(`${app} [data-trigger="bookshelf.modal.private.open"]`,e=>e===document.activeElement),'Existing shelf opener focus is restored');
 });
 await run('other-user-public-books-are-independent',async p=>{
  const {before,id,owner}=await start(p);const peer=before.users.find(u=>u.id!==before.user.id&&u.recentBooks?.includes(id));assert.ok(peer,'Use an actual other-user source with the same public book');
  const cards=()=>p.$$eval(`${app} [data-trigger="book.detail.open"]`,es=>es.filter(e=>e.checkVisibility()).map(e=>JSON.parse(e.dataset.triggerParams).bookId));
  await openPilotApp(p,'wechat_reading','/user/'+encodeURIComponent(peer.id));const original=await cards();assert.ok(original.includes(id));
  await menu(p,owner);await submit(p,id,true);await openPilotApp(p,'wechat_reading','/user/'+encodeURIComponent(peer.id));assert.deepEqual(await cards(),original,'Own private flag must not rewrite another user public source');
 });
 await run('real-profile-source-back-return',async p=>{
  const {id,owner}=await start(p);const origin='/my-profile?tab=shelf';await openPilotApp(p,'wechat_reading',origin);
  const card=`${app} [data-trigger="book.detail.open"][data-trigger-params='${JSON.stringify({bookId:id})}']`;await hitClick(p,card);await p.waitForFunction(owner=>window.__OS__.getAppRoute('wechat_reading').path===owner,{},owner);
  await hitClick(p,`${app} [data-trigger="book.modal.shelf.open"]`);await p.waitForSelector(action,{visible:true});await submit(p,id,true);assert.equal(await route(p),owner);
  await p.evaluate(()=>window.__OS__.handleBack());await p.waitForFunction(origin=>window.__OS__.getAppRoute('wechat_reading').path===origin,{},origin);assert.equal(await visibleBook(p,id,'book.detail.open'),false,'One Back returns to the real public source, with its private card removed');
 });
 await run('own-private-book-reader-entry',async p=>{
  const {before,id,owner}=await start(p);await menu(p,owner);await submit(p,id,true);await openPilotApp(p,'wechat_reading','/bookshelf');
  await hitClick(p,`${app} [data-shelf-book-id="${id}"]`);await p.waitForFunction(id=>window.__OS__.getAppRoute('wechat_reading').path==='/read/'+encodeURIComponent(id),{},id);await p.waitForSelector(`${app} [data-reader-page]`,{visible:true});
  await p.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));assert.equal(await route(p),'/read/'+encodeURIComponent(id));assert.deepEqual((await state(p)).shelf,before.shelf.map(e=>e.bookId===id?{...e,isPrivate:true}:e),'Entering the existing reader keeps the same private shelf entry');
 });
 await run('removed-record-and-audio-cannot-submit',async p=>{
  const {before,id,owner}=await start(p);await menu(p,owner);await p.evaluate(({action,id})=>{const button=document.querySelector(action),shelf=window.__SIM__.getState().apps.wechat_reading.shelf.filter(i=>i.bookId!==id);window.__SIM__.setState({apps:{wechat_reading:{shelf}}});button.click();},{action,id});assert.deepEqual((await state(p)).shelf,before.shelf.filter(i=>i.bookId!==id));assert.equal(await p.$eval(action,e=>e.disabled),true);await p.click(`${app} [data-reading-book-cancel]`);
  await openPilotApp(p,'wechat_reading','/book/audio_1?modal=shelf');await p.waitForSelector(action,{visible:true});assert.equal(await p.$eval(action,e=>e.disabled),true);
 });
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length&&!errors.length,checks,failures,errors,scope:'Local detail privacy flags and public preview visibility; not real WeChat-account privacy or native menu pixel certification'},null,2));}
console.log(JSON.stringify({output,checks,failures,errors}));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
