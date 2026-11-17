import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'artifacts/bilibili-player-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const page=await browser.newPage(),checks=[],errors=[],geometry=[];page.on('pageerror',e=>errors.push(e.message));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
await page.setRequestInterception(true);
page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol))||u.pathname==='/api'||u.pathname.startsWith('/api/'))r.abort();else r.continue()});
const app='[data-app-id="bilibili"]',player=`${app} [data-bili-player]`,slider=`${player} [role="slider"]`,details=`${app} [data-bili-detail-content]`,main=`${details} [data-scroll-container="main"]`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const route=()=>page.evaluate(()=>window.__OS__.getAppRoute('bilibili').path);
const records=()=>page.evaluate(()=>{const s=window.__SIM__.getState().apps.bilibili;return{user:s.user,settings:s.settings}});
const simNow=()=>page.evaluate(()=>window.__SIM_TIME__.now());
function assertVisitHistory(actual, original, visits, start, end) {
 const expectedIds=visits.reduce((history,id)=>[id,...history.filter(value=>value!==id)].slice(0,100),original.user.videoHistory||[]);
 assert.deepEqual(actual.user.videoHistory,expectedIds,'Visited IDs must be deduplicated and most-recent first');
 const actualTimes=actual.user.videoHistorySeenAt||{}, oldTimes=original.user.videoHistorySeenAt||{};
 const visited=new Set(visits), expectedKeys=new Set(expectedIds.filter(id=>visited.has(id)||(Number.isFinite(oldTimes[id]))));
 assert.deepEqual(new Set(Object.keys(actualTimes)),expectedKeys,'Only retained visits may have timestamps');
 for(const id of expectedKeys){
  if(visited.has(id)) assert.ok(Number.isFinite(actualTimes[id])&&actualTimes[id]>=start&&actualTimes[id]<=end,`Visit timestamp must be simulator time: ${id}`);
  else assert.equal(actualTimes[id],oldTimes[id],`Unvisited history timestamp must be preserved: ${id}`);
 }
 const {videoHistory:ignoredIds,videoHistorySeenAt:ignoredTimes,...user}=actual.user;
 const {videoHistory:oldIds,videoHistorySeenAt:oldSeen,...oldUser}=original.user;
 assert.deepEqual({user,settings:actual.settings},{user:oldUser,settings:original.settings},'Other user records and original language/settings must be unchanged');
}
async function snapshot(){return page.$eval(player,e=>({id:e.dataset.videoId,full:e.dataset.fullscreen==='true',playing:e.dataset.playing==='true',position:Number(e.querySelector('[role="slider"]').getAttribute('aria-valuenow')),duration:Number(e.querySelector('[role="slider"]').getAttribute('aria-valuemax'))}));}
async function back(){await page.evaluate(()=>window.__OS__.handleBack());await wait(100);}
async function posture(value){await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),value);await wait(450);}
async function controls(){if(await page.$eval(`${player} [aria-hidden]`,e=>e.getAttribute('aria-hidden')==='true'))await page.click(`${player} > button.absolute.inset-0`);}
async function pause(){await controls();if((await snapshot()).playing)await page.click(`${player} button[aria-pressed]`);assert.equal((await snapshot()).playing,false);}
async function seek(seconds){await controls();const s=await snapshot(),p=await page.$eval(slider,(e,ratio)=>{const r=e.getBoundingClientRect();return{x:r.x+r.width*ratio,y:r.y+r.height/2}},seconds/s.duration);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.up();await wait(30);}
async function fullscreen(){await controls();await page.click(`${player} [data-trigger="video.player.fullscreen.open"]`);await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.fullscreen==='true',{},player);}
async function assertFull(value,label){
 const m=await page.$eval(player,(e,app)=>{const a=document.querySelector(app).getBoundingClientRect(),r=e.getBoundingClientRect();return{a:{x:a.x,y:a.y,w:a.width,h:a.height},r:{x:r.x,y:r.y,w:r.width,h:r.height},inert:document.querySelector('[data-bili-detail-content]').inert}},app);geometry.push({label,posture:value,...m});
 assert.equal(m.inert,true);for(const key of ['x','y','w','h'])assert.ok(Math.abs(m.a[key]-m.r[key])<2,`${label}: app-contained fullscreen ${key}`);
}
async function switchTab(tab){await page.click(`${app} [data-trigger="video.tab.switch"][data-trigger-params='{"tab":"${tab}"}']`);await page.waitForFunction(tab=>new URLSearchParams(window.__OS__.getAppRoute('bilibili').path.split('?')[1]).get('tab')===tab,{},tab);}
try{
 await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SIM__&&window.__FOLDAGENT__);
 await openPilotApp(page,'bilibili','/?tab=recommend');await page.waitForSelector('.bili-recommend-grid [data-trigger="video.open"]');const original=await records(), historyStart=await simNow();
 await page.click('.bili-recommend-grid [data-trigger="video.open"]');await page.waitForSelector(player);await pause();const firstId=(await snapshot()).id;
 for(const value of ['folded','unfolded']){
  await posture(value);await seek(21);const start=await snapshot();assert.ok(Math.abs(start.position-21)<1);
  const p=await page.$eval(slider,e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width*.4,y:r.y+r.height/2}});
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+20,p.y,{steps:4});const moved=await snapshot();
  await page.evaluate(selector=>{const el=document.querySelector(selector);for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:999,isPrimary:false,clientX:0,buttons:1}));},slider);
  assert.equal((await snapshot()).position,moved.position,'Foreign pointer cannot seek/end the primary gesture');
  await page.evaluate(selector=>document.querySelector(selector).dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1,isPrimary:true})),slider);await page.mouse.up();
  assert.equal((await snapshot()).position,start.position,'Pointer cancel restores pre-gesture paused position');assert.equal((await snapshot()).playing,false);
  await fullscreen();assert.match(await route(),/view=fullscreen/);await assertFull(value,'intro fullscreen');assert.equal((await snapshot()).position,start.position);
  await page.focus(slider);for(let i=0;i<18;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[data-bili-detail-content]')),false,'Fullscreen details are inert to Tab');}
  await page.screenshot({path:path.join(output,`${value}-fullscreen.png`)});await back();assert.equal((await snapshot()).full,false);assert.equal((await snapshot()).position,start.position);
  await switchTab('comment');await fullscreen();await assertFull(value,'comment fullscreen');await back();assert.equal(new URLSearchParams((await route()).split('?')[1]).get('tab'),'comment');assert.equal((await snapshot()).position,start.position);
  await switchTab('intro');await controls();await page.evaluate(selector=>{const el=document.querySelector(selector);el.click();el.click()},`${player} [data-trigger="video.player.fullscreen.open"]`);await page.waitForFunction(selector=>document.querySelector(selector)?.dataset.fullscreen==='true',{},player);await back();assert.equal((await snapshot()).full,false,'Double open creates only one overlay');
  checks.push(`${value}: exact pause/seek, primary-pointer isolation, cancellation rollback, intro/comment fullscreen geometry, inert Tab exclusion, single Back, preserved timeline/tab and duplicate-open guard`);
 }
 await controls();await page.focus(slider);await page.keyboard.press('End');let s=await snapshot();assert.equal(s.position,s.duration);assert.equal(s.playing,false);
 await page.click(`${player} button[aria-pressed]`);await wait(700);s=await snapshot();assert.ok(s.position>0&&s.position<2,'Replay restarts at zero and advances actual physical time');await pause();
 await page.focus(slider);await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.equal((await snapshot()).position,5);
 await seek(21);const positionA=(await snapshot()).position;
 await page.$eval(`${app} [data-trigger="video.open.fromVideo"]`,el=>el.scrollIntoView({block:'center'}));await wait(100);const originScroll=await page.$eval(main,el=>el.scrollTop);
 await page.click(`${app} [data-trigger="video.open.fromVideo"]`);await page.waitForFunction(({selector,id})=>document.querySelector(selector)?.dataset.videoId!==id,{}, {selector:player,id:firstId});await wait(700);
 s=await snapshot();const relatedId=s.id;assert.ok(s.position<2,'New video must not inherit old sought seconds');assert.equal(await page.$eval(main,el=>el.scrollTop),0,'Related video starts at top');await pause();
 await back();await page.waitForFunction(({selector,id})=>document.querySelector(selector)?.dataset.videoId===id,{}, {selector:player,id:firstId});
 s=await snapshot();assert.equal(s.position,positionA,'Back restores original paused timeline');assert.equal(s.playing,false);assert.ok(Math.abs(await page.$eval(main,el=>el.scrollTop)-originScroll)<3,'Back restores originating detail scroll');
 checks.push('End/replay and keyboard seek work; related video starts with its own clock/top; Back restores exact paused video position and originating detail scroll');
 await fullscreen();await posture('folded');assert.equal((await snapshot()).position,positionA);await assertFull('folded','posture retention');await posture('unfolded');await assertFull('unfolded','posture retention');await back();
 await openPilotApp(page,'bilibili','/video/nonexistent-research-id?tab=intro');await page.waitForSelector(`${app} [role="alert"]`);assert.equal(await page.$(player),null);assert.equal(await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.activeVideoId),null);await back();
 assert.equal((await snapshot()).id,firstId);assert.equal((await snapshot()).position,positionA);
 checks.push('Unknown video IDs cannot masquerade as another video or become active; valid Back recovers original session');
 // Real app settings, not fixture injection, validate localized player controls.
 await openPilotApp(page,'bilibili','/settings/language');
 const buttons=await page.$$(`${app} button,${app} [role="radio"],${app} .cursor-pointer`);let found=false;
 for(const button of buttons){if((await button.evaluate(e=>e.textContent.trim()))==='English'){await button.click();found=true;break;}}
 assert.equal(found,true,'Real English language choice exists');await back();await page.waitForSelector(player);await controls();assert.equal(await page.$eval(`${player} button[aria-pressed]`,el=>el.getAttribute('aria-label')),'Play');
 await fullscreen();assert.ok(await page.$(`${player} [aria-label="Exit fullscreen"]`));await back();
 await openPilotApp(page,'bilibili','/settings/language');
 for(const button of await page.$$(`${app} button,${app} [role="radio"],${app} .cursor-pointer`)){if((await button.evaluate(e=>e.textContent.trim()))==='简体中文'){await button.click();break;}}
 await back();
 const historyAfterVisits=await records(),historyEnd=await simNow(),visits=[firstId,relatedId,firstId];
 assertVisitHistory(historyAfterVisits,original,visits,historyStart,historyEnd);
 // Negative controls ensure the checker rejects wrong order, fabricated timestamps and unrelated edits.
 const wrongOrder=structuredClone(historyAfterVisits);wrongOrder.user.videoHistory=[...wrongOrder.user.videoHistory].reverse();
 assert.throws(()=>assertVisitHistory(wrongOrder,original,visits,historyStart,historyEnd));
 const badTime=structuredClone(historyAfterVisits);badTime.user.videoHistorySeenAt[firstId]=historyStart-1;
 assert.throws(()=>assertVisitHistory(badTime,original,visits,historyStart,historyEnd));
 const changedUser=structuredClone(historyAfterVisits);changedUser.user.name+=' (unexpected)';
 assert.throws(()=>assertVisitHistory(changedUser,original,visits,historyStart,historyEnd));
 await page.evaluate(()=>window.__OS__.closeApp('bilibili'));await wait(150);
 await openPilotApp(page,'bilibili',`/video/${firstId}?tab=comment&view=fullscreen`);await page.waitForSelector(player);await pause();await back();assert.equal((await snapshot()).full,false);assert.equal(new URLSearchParams((await route()).split('?')[1]).get('tab'),'comment');
 const beforeReload=await records();assertVisitHistory(beforeReload,original,[firstId,relatedId,firstId,firstId],historyStart,await simNow());
 await page.setViewport({width:900,height:780});for(const value of ['folded','unfolded']){await posture(value);await fullscreen();await assertFull(value,'narrow browser');await back();}
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SIM__?.getState().apps.bilibili);assert.deepEqual(await records(),beforeReload,'Reload preserves exact local history and all other records');assert.equal(await page.$(player),null,'Transient playback does not persist as business data');
 checks.push('English setting is restored; visits and timestamps are correct without changing other records; cold-fullscreen/narrow Back and reload preserve history while dropping transient sessions');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,checks,geometry,errors},null,2));console.log(JSON.stringify({passed:true,output,checks}));
}catch(error){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,checks,geometry,errors,error:String(error),stack:error.stack},null,2));console.error(JSON.stringify({passed:false,output,error:String(error)}));process.exitCode=1;}finally{await browser.close();}
