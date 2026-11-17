// Isolated local browser and default simulator notes; no real reminders or private content.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const frontend=['mobilegym','foldmobilegym'].find(x=>fs.existsSync(path.join(root,x,'package.json')));
const require=createRequire(path.join(root,frontend,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3217/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath});
const checks=[],failures=[];
try{
 for(const locale of ['zh-Hans','en'])for(const date of ['2026-03-07T12:00:00-05:00','2026-10-31T12:00:00-04:00']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
  try{
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.origin===url.origin&&u.pathname!=='/api'&&!u.pathname.startsWith('/api/'))r.continue();else r.abort()});
   await page.setViewport({width:1440,height:1100});await page.emulateTimezone('America/New_York');
   await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__SIM_TIME__&&window.__FOLDAGENT__);
   const id=await page.evaluate(({locale,date})=>{
    window.__OS__.locale.setLocale(locale);window.__SIM_TIME__.setSimulatedTime(date,false);window.__FOLDAGENT__.setPosture('unfolded');
    const note=window.__SIM__.getState().apps.notes.notes.find(n=>!n.isPrivate&&!n.trashedAt&&!n.hasChecklist);
    if(!note)throw new Error('Missing synthetic default note');window.__OS__.openApp('notes','/note/'+encodeURIComponent(note.id));return note.id;
   },{locale,date});
   const original=await page.evaluate(id=>JSON.stringify(window.__SIM__.getState().apps.notes.notes.find(note=>note.id===id)),id);
   const app='[data-app-id="notes"]',sheet=app+' [data-notes-sheet="reminder"]',column=sheet+' [data-reminder-column="reminderDay"]';
   await page.waitForSelector(app+' [data-trigger="notes.editor.menu.open"]',{visible:true});
   await page.click(app+' [data-trigger="notes.editor.menu.open"]');
   await page.waitForSelector(app+' [data-notes-sheet="menu"] [data-trigger="notes.editor.reminder.open"]',{visible:true});
   await page.click(app+' [data-notes-sheet="menu"] [data-trigger="notes.editor.reminder.open"]');
   await page.waitForSelector(column,{visible:true});
   const data=await page.$eval(column,el=>[...el.querySelectorAll('[role="option"]')].map(x=>Number(x.id.match(/(\d+)$/)?.[1])));
   assert.equal(data.length,367);assert.ok(data.every(Number.isFinite));
   const valid=await page.evaluate(values=>{
    const expected=new Date(values[0]),unique=new Set();
    for(const value of values){const current=new Date(value);if(current.getTime()!==expected.getTime())return false;unique.add(`${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`);expected.setDate(expected.getDate()+1)}
    return unique.size===values.length;
   },data);
   assert.equal(valid,true,'Each date must represent the next local midnight, including DST changes');
   // Move across the transition via the real keyboard-operated wheel, then fold.
   await page.focus(column);await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
   await page.waitForFunction(({selector,value})=>Number(JSON.parse(document.querySelector(selector)?.getAttribute('data-action-params')||'{}').value)===value,{}, {selector:column,value:data[2]});
   const before=await page.$eval(sheet+' [data-reminder-selected]',el=>Number(el.dataset.reminderSelected));
   await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));
   await page.waitForFunction(({selector,value})=>Number(document.querySelector(selector)?.dataset.reminderSelected)===value,{}, {selector:sheet+' [data-reminder-selected]',value:before});
   await page.evaluate(()=>window.__OS__.handleBack());
   await page.waitForFunction(id=>!window.__OS__.getAppRoute('notes').path.includes('sheet=reminder'),{},id);
   assert.equal(await page.evaluate(id=>JSON.stringify(window.__SIM__.getState().apps.notes.notes.find(note=>note.id===id)),id),original,'Cancel must not save or alter the note');
   assert.deepEqual(errors,[]);checks.push(`${locale}-${date}`);console.log('PASS',locale,date);
  }catch(e){failures.push(`${locale}-${date}: ${String(e)}`);console.error('FAIL',locale,date,String(e))}finally{await context.close()}
 }
}finally{await browser.close()}
console.log(JSON.stringify({checks,failures}));if(failures.length)process.exitCode=1;
