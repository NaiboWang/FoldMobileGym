import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), {recursive:true});
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3188/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&!url.username&&!url.password);
const output=fs.mkdtempSync(path.join(root,'artifacts/calendar-event-ranges-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
let context,page,failure;const checks=[],geometry=[],errors=[];const app='[data-app-id="calendar"]',wait=ms=>new Promise(r=>setTimeout(r,ms));
const field=name=>`${app} [data-benchmark-field="calendar-${name}"]`;
const state=()=>page.evaluate(()=>window.__SIM__.getState().apps.calendar);
const business=record=>{const {start,end,note,...event}=record;return JSON.parse(JSON.stringify(event))};
const assertAliases=snapshot=>{for(const row of snapshot.events){assert.equal(Date.parse(row.start),row.startTs,'Snapshot start must represent the exact stored instant');assert.equal(Date.parse(row.end),row.endTs,'Snapshot end must represent the exact stored instant')}};
const event=async id=>{const snapshot=await state();assertAliases(snapshot);return business(snapshot.events.find(e=>e.id===id))};
async function fresh(zone='Asia/Shanghai'){if(context)await context.close();context=await browser.createBrowserContext();page=await context.newPage();await page.emulateTimezone(zone);await page.setViewport({width:1440,height:1100});page.on('pageerror',e=>errors.push(e.message));await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);await openPilotApp(page,'calendar','/');}
async function route(value){await page.waitForFunction(value=>window.__OS__.getAppRoute('calendar').path===value,{timeout:5000},value)}
async function click(selector,double=false){await page.waitForSelector(selector,{visible:true});if(double)await page.$eval(selector,e=>{e.click();e.click()});else await page.click(selector)}
async function back(){await page.evaluate(()=>window.__OS__.handleBack());await wait(100)}
async function hide(){await page.evaluate(()=>{document.activeElement?.blur();window.__OS__.keyboard.hide()})}
async function restore(value){await page.evaluate(value=>window.__SIM__.setState({apps:{calendar:value}},{deep:false,reload:false}),value);await wait(100)}
async function posture(value){await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),value);await wait(450)}
async function patch(value){await page.evaluate(value=>window.__SIM__.setState({apps:{calendar:value}},{deep:true,reload:false}),value);await wait(100)}
async function setDate(name,value){await page.$eval(field(name),(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);await wait(100)}
async function edit(id){await openPilotApp(page,'calendar','/event/'+id);await click(`${app} [data-trigger="event.edit"]`);await route('/event/'+id+'/edit');await page.waitForSelector(field('title'),{visible:true})}
async function values(){return page.evaluate(app=>Object.fromEntries(['title','start-date','end-date','start-time','end-time'].map(name=>[name,document.querySelector(app+' [data-benchmark-field="calendar-'+name+'"]').value])),app)}
async function save(id,parent='/'){await click(`${app} [data-action="${id?'calendar.edit.save.submit':'calendar.new.save.submit'}"]`,true);await route(id?'/event/'+id:parent);}
async function rangeIs(start,end){const value=await values();assert.equal(value['start-date'],start);assert.equal(value['end-date'],end)}
async function bounds(label){const row=await page.$eval(app,root=>{const a=root.getBoundingClientRect();const controls=[...root.querySelectorAll('.calendar-event-editor > div > div:first-child button,.calendar-event-detail-actions button')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}});const r=root.querySelector('.calendar-event-editor,.calendar-event-detail')?.getBoundingClientRect();return{app:{x:a.x,y:a.y,right:a.right,bottom:a.bottom},controls,page:r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom}:null,overflow:[...root.querySelectorAll('[data-calendar-range-start],[data-calendar-range-end],[data-calendar-location]')].some(e=>{const r=e.getBoundingClientRect();return r.x<a.x-1||r.right>a.right+1})}});geometry.push({label,...row});assert.equal(row.overflow,false);for(const c of row.controls)assert.ok(c.x>=row.app.x-1&&c.right<=row.app.right+1,label+' control containment')}
async function fixtures(){return page.evaluate(()=>{const at=(y,m,d,h=0,min=0)=>new Date(y,m-1,d,h,min).getTime();return[
{id:'range_owned_all_day',type:'event',title:'Owned three-day event',description:'  exact notes\nwith preserved whitespace  ',location:'  Exact owned venue  ',allDay:true,startTs:at(2026,10,18),endTs:at(2026,10,21),calendarAccount:'Owned account',color:'#7744aa',reminderMinutesBefore:60,alarmEnabled:false},
{id:'range_owned_timed',type:'event',title:'Owned cross-year event',description:'Unchanged notes',location:'Second owned venue',allDay:false,startTs:at(2026,12,31,23,30)+12345,endTs:at(2027,1,2,0,15)+45678,calendarAccount:'Second owned account',color:'#118855',reminderMinutesBefore:null,alarmEnabled:false},
{id:'range_owned_optional',type:'event',title:'Owned no-account event',allDay:false,startTs:at(2026,10,18,9),endTs:at(2026,10,18,10)}]})}
try{
 await fresh();const original=await state(),originalRaw={settings:original.settings,events:original.events.map(business),selectedDateTs:original.selectedDateTs,createdCount:original.createdCount,deletedCount:original.deletedCount,mutationCount:original.mutationCount,draft:original.draft};
 for(const mode of ['folded','unfolded']){
  await posture(mode);const records=await fixtures();await patch({...originalRaw,events:[...originalRaw.events,...records]});
  for(const fixture of records){
   const before=await state();await edit(fixture.id);if(fixture.allDay)await rangeIs('2026-10-18','2026-10-21');
   assert.equal(await page.$eval(`${app} [data-calendar-editor-account]`,el=>el.textContent),fixture.calendarAccount||'小米日历');
   const title=fixture.title+' renamed';await page.focus(field('title'));await page.keyboard.press('End');await page.type(field('title'),' renamed');
   assert.equal(await page.evaluate(()=>window.__OS__.keyboard.getState().visible),true);await bounds(mode+' title keyboard');await back();await route('/event/'+fixture.id+'/edit');assert.equal(await page.$eval(field('title'),e=>e.value),title);
   await posture(mode==='folded'?'unfolded':'folded');await posture(mode);assert.equal(await page.$eval(field('title'),e=>e.value),title);
   if(fixture.allDay){await rangeIs('2026-10-18','2026-10-21');await click(`${app} [data-trigger="reminder.edit.open"]`);await route('/event/'+fixture.id+'/edit?sheet=reminder');await back();await route('/event/'+fixture.id+'/edit');await rangeIs('2026-10-18','2026-10-21');}
   await save(fixture.id);assert.deepEqual(await event(fixture.id),{...fixture,title});assert.equal((await state()).mutationCount,before.mutationCount+1);assert.equal((await state()).createdCount,before.createdCount);
   assert.equal(await page.$eval(`${app} [data-calendar-location]`,e=>e.textContent).catch(()=>null),fixture.location||null);await bounds(mode+' saved detail');
   if(!fixture.allDay)assert.equal((await event(fixture.id)).startTs,fixture.startTs,'Untouched seconds/milliseconds must stay exact');
  }
  const all=records[0];await edit(all.id);await setDate('start-date','2026-10-19');await rangeIs('2026-10-19','2026-10-22');await setDate('end-date','2026-10-24');await rangeIs('2026-10-19','2026-10-24');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__);await openPilotApp(page,'calendar','/event/'+all.id+'/edit');await rangeIs('2026-10-19','2026-10-24');
  await page.evaluate(()=>window.__OS__.closeApp('calendar'));await wait(100);await openPilotApp(page,'calendar','/event/'+all.id+'/edit');await rangeIs('2026-10-19','2026-10-24');
  const beforeInvalid=await state();await setDate('end-date','2026-10-19');await click(`${app} [data-action="calendar.edit.save.submit"]`);await wait(150);await route('/event/'+all.id+'/edit');assert.deepEqual((await state()).events,beforeInvalid.events);assert.equal((await state()).mutationCount,beforeInvalid.mutationCount);
  await setDate('end-date','2026-10-24');await save(all.id);const saved=await event(all.id);assert.equal(saved.calendarAccount,all.calendarAccount);assert.equal(saved.color,all.color);assert.equal(await page.$eval(`${app} [data-calendar-all-day-boundary]`,e=>e.textContent.includes('不包含')),true);
  await page.evaluate(()=>window.__OS__.locale.setLocale('en'));await openPilotApp(page,'calendar','/event/'+records[1].id);const endpoints=await page.$$eval(`${app} [data-calendar-range-start],${app} [data-calendar-range-end]`,els=>els.map(el=>el.textContent));assert.equal(endpoints.length,2);assert.match(endpoints[0],/2026/);assert.match(endpoints[1],/2027/);assert.equal(endpoints.some(text=>text.includes('年')),false);await page.screenshot({path:path.join(output,mode+'-english-cross-year.png')});await page.evaluate(()=>window.__OS__.locale.setLocale('zh-Hans'));
  const timed=records[1];await edit(timed.id);await click(`${app} [data-action="calendar.edit.allDay.toggle"]`);await rangeIs('2026-12-31','2027-01-03');assert.equal(await page.$eval(`${app} [data-action="calendar.edit.allDay.toggle"]`,el=>el.getAttribute('aria-checked')),'true');await save(timed.id);assert.equal((await event(timed.id)).color,timed.color);assert.equal((await event(timed.id)).calendarAccount,timed.calendarAccount);
  // New multi-day events remain one creation despite same-turn save activation.
  await openPilotApp(page,'calendar','/new-event');await page.type(field('title'),mode+' owned new all-day');await hide();await click(`${app} [data-action="calendar.new.moreSettings.toggle"]`);await click(`${app} [data-action="calendar.new.allDay.toggle"]`);await setDate('start-date','2026-10-18');await setDate('end-date','2026-10-22');const beforeCreate=await state();await save(undefined,'/event/'+timed.id);const afterCreate=await state(),created=afterCreate.events.find(e=>!beforeCreate.events.some(old=>old.id===e.id));assert.ok(created);assert.equal(afterCreate.createdCount,beforeCreate.createdCount+1);assert.equal(afterCreate.mutationCount,beforeCreate.mutationCount+1);assert.equal(created.allDay,true);assert.equal(await page.evaluate(ts=>new Date(ts).getDate(),created.endTs),22);
  for(const record of original.events)assert.deepEqual(afterCreate.events.find(e=>e.id===record.id),record,'Every original event stays exact');
  checks.push(mode+': exact three-day/title-only preservation, account/color/optional-field identity, subminute timestamps, keyboard/reminder/fold, all-day move/extension, reload/recreation, invalid-boundary rejection, real duplicate-safe create, localized complete detail dates/location');
 }
 await restore(originalRaw);assert.deepEqual(await state(),original);
 const fixture={...(await fixtures())[1],id:'range_source_owner',title:'Original source owner'};
 await patch({events:[...originalRaw.events,fixture]});await edit(fixture.id);await page.type(field('title'),' dirty');await hide();
 const replacement={...fixture,title:'Fresh same-ID source',startTs:fixture.startTs+7*86400000,endTs:fixture.endTs+7*86400000,calendarAccount:'Fresh account',color:'#aabbcc'};
 const beforeReplacement=await state();await patch({events:[...originalRaw.events,replacement]});await page.waitForSelector(`${app} [data-calendar-source-changed]`,{visible:true});assert.equal(await page.$eval(`${app} [data-action="calendar.edit.save.submit"]`,el=>el.disabled),true);
 await page.$eval(`${app} [data-action="calendar.edit.save.submit"]`,el=>el.click());assert.deepEqual(await event(fixture.id),replacement);assert.equal((await state()).mutationCount,beforeReplacement.mutationCount);assert.equal((await state()).draft.eventId===fixture.id,false,'Only the old editor-owned draft is cleared after source invalidation');
 await back();await route('/event/'+fixture.id);await edit(fixture.id);assert.equal(await page.$eval(field('title'),el=>el.value),replacement.title,'Reopening cannot restore the invalidated old source buffer');
 await page.click(field('title'));await page.keyboard.press('End');await page.type(field('title'),' accepted');assert.equal(await page.evaluate(()=>window.__OS__.keyboard.getState().visible),true);await save(fixture.id);assert.equal(await page.evaluate(()=>window.__OS__.keyboard.getState().visible),false,'Direct keyboard-open Save blurs only its owned editor before returning');assert.equal((await event(fixture.id)).title,replacement.title+' accepted');
 await edit(fixture.id);await page.type(field('title'),' background');await hide();const beforeHidden=await state();await openPilotApp(page,'x','/?tab=foryou');await page.$eval(`${app} [data-action="calendar.edit.save.submit"]`,el=>el.click());await wait(100);assert.deepEqual((await state()).events,beforeHidden.events);assert.equal((await state()).mutationCount,beforeHidden.mutationCount);assert.equal(await page.evaluate(()=>window.__OS__.getState().activeAppId),'x');
 await page.evaluate(()=>window.__OS__.openApp('calendar'));await page.waitForFunction(()=>window.__OS__.getState().activeAppId==='calendar');await back();await route('/event/'+fixture.id+'/edit?sheet=discard');assert.match(await page.$eval(`${app} .calendar-discard-prompt h2`,e=>e.textContent),/放弃|Discard/);await click(`${app} [data-action="calendar.edit.discard.submit"]`);await route('/event/'+fixture.id);await restore(originalRaw);assert.deepEqual(await state(),original);
 checks.push('A replaced same-ID source invalidates old Save/draft, reopens the real updated event, preserves account/color/time, direct keyboard-open Save returns safely, and background old callbacks cannot mutate events/counters');
 // Actual browser timezone scenarios: preserve midnight and day-count across DST.
 for(const zone of ['America/New_York','Europe/Berlin']){
  await fresh(zone);const initial=await state(),base=initial.events.map(business);
  const transitionDay=zone==='America/New_York'?8:29;
  const fixture=await page.evaluate(day=>({id:'range_owned_dst',type:'event',title:'Owned DST all-day span',allDay:true,startTs:new Date(2026,2,day-1).getTime(),endTs:new Date(2026,2,day+2).getTime(),calendarAccount:'DST owned account',color:'#567890'}),transitionDay);
  await patch({events:[...base,fixture]});await edit(fixture.id);const expectedStart=zone==='America/New_York'?'2026-03-08':'2026-03-29',expectedEnd=zone==='America/New_York'?'2026-03-11':'2026-04-01';await setDate('start-date',expectedStart);await rangeIs(expectedStart,expectedEnd);await save(fixture.id);
  const saved=await event(fixture.id),parts=await page.evaluate(record=>({startHour:new Date(record.startTs).getHours(),endHour:new Date(record.endTs).getHours(),endDay:new Date(record.endTs).getDate(),hours:(record.endTs-record.startTs)/3600000}),saved);assert.equal(parts.startHour,0);assert.equal(parts.endHour,0);assert.equal(parts.endDay,zone==='America/New_York'?11:1);assert.equal(parts.hours,71,'Each actual regional spring transition spans three civil days in 71 hours');
  assert.equal(saved.color,fixture.color);assert.equal(saved.calendarAccount,fixture.calendarAccount);
  await edit(fixture.id);const normalStart=zone==='America/New_York'?'2026-03-10':'2026-03-31',normalEnd=zone==='America/New_York'?'2026-03-13':'2026-04-03';await setDate('start-date',normalStart);await rangeIs(normalStart,normalEnd);await save(fixture.id);const normal=await event(fixture.id);assert.equal((normal.endTs-normal.startTs)/3600000,72,'Moving past DST changes elapsed hours, never the three civil-day span');
  await page.evaluate(()=>window.__OS__.locale.setLocale('en'));await page.setViewport({width:900,height:780});for(const mode of ['folded','unfolded']){await posture(mode);await bounds(zone+' '+mode+' narrow');await edit(fixture.id);await page.focus(field('title'));await bounds(zone+' '+mode+' narrow keyboard');await hide();await back();await route('/event/'+fixture.id)}
  for(const record of initial.events)assert.deepEqual((await state()).events.find(e=>e.id===record.id),record);
  checks.push(zone+': actual timezone-emulated UI and snapshot aliases retain the same exact instant, local midnight and three civil days across the actual regional transition and back to normal dates (71 then 72 elapsed hours), untouched account/color, narrow double-posture keyboard bounds and original records');
 }
 assert.deepEqual(errors,[]);
}catch(error){failure=error.stack;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{})}
finally{fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failure,checks,geometry,errors,failure},null,2));await browser.close();console.log(JSON.stringify({passed:!failure,output,checks,failure},null,2))}
if(failure)process.exitCode=1;
