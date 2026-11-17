// Generate a privacy-safe example through the real UI in a disposable browser profile.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
try{const page=await browser.newPage();await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);await page.evaluate(()=>{window.__FOLDAGENT__.setPosture('folded');window.__OS__.locale.setLocale('zh-Hans');});await openPilotApp(page,'calendar','/todos');
const app='[data-app-id="calendar"]',editor=`${app} .calendar-todo-editor`;
const yesterday=await page.evaluate(()=>{const d=window.__SIM_TIME__.getDate();d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
for(const [title,due] of [['整理项目说明',yesterday],['检查本地部署',null],['准备演示截图',null]]){
 await page.click(`${app} [data-trigger="todos.new.open"]`);await page.waitForSelector(editor);await page.type(`${editor} textarea`,title);
 if(due)await page.$eval(`${editor} input[type="date"]`,(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},due);
 await page.click(`${editor} [data-action="calendar.todo.create"]`);await page.waitForSelector(editor,{hidden:true});
}
await page.$eval(`${app} .calendar-todos-list`,el=>{const row=[...el.querySelectorAll('[data-calendar-todo-id]')].find(row=>row.textContent.includes('检查本地部署'));row.querySelector('[role="checkbox"]').click();});
await page.waitForSelector(`${app} [data-calendar-todo-group="completed"]`);await new Promise(r=>setTimeout(r,400));
const output=path.join(root,'media_sources/readme-screenshots/calendar-todos-folded.png');fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:output});
console.log(JSON.stringify({passed:true,output,source:url.href,data:'Only three synthetic demonstration todos created through UI; default store/data files untouched'}));
}finally{await browser.close();}
