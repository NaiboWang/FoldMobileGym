import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const frontend=fs.existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,frontend,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3379/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const context=await browser.createBrowserContext(),p=await context.newPage(),errors=[];
p.on('pageerror',e=>errors.push(String(e)));
const app='[data-app-id="contacts"]';
try {
 await p.setViewport({width:1440,height:1100}); await p.goto(url.href);
 await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
 await p.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));
 await openPilotApp(p,'contacts','/contact/c_alice');
 await p.evaluate(()=>{
   const content=window.__OS__.content;
   for(const displayName of ['陈测试','李测试','王测试','张测试','123456789']) content.insert('content://contacts/contacts',{displayName,phones:[]});
 });
 await p.waitForFunction(app=>document.querySelector(`${app} [data-scroll-container="directory"]`)?.textContent.includes('张测试'),{},app);
 const groups=await p.evaluate(app=>{
   const list=document.querySelector(`${app} [data-scroll-container="directory"]`);
   return Object.fromEntries(['陈测试','李测试','王测试','张测试','123456789'].map(name=>{
     const row=[...list.querySelectorAll('.contacts-reference-row')].find(e=>e.textContent.includes(name));
     return [name,row?.parentElement?.querySelector('[data-contact-section]')?.textContent];
   }));
 },app);
 assert.deepEqual(groups,{'陈测试':'C','李测试':'L','王测试':'W','张测试':'Z','123456789':'#'});
 const point=await p.$eval(`${app} .contacts-alphabet-index [data-section="C"]`,e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
 await p.mouse.click(point.x,point.y);
 await p.waitForFunction(app=>document.querySelector(`${app} .contacts-alphabet-index`)?.getAttribute('aria-valuetext')==='C',{},app);
 await p.click(`${app} .contacts-directory-search`); await p.type(`${app} .contacts-directory-search`,'陈测试');
 await p.waitForFunction(app=>document.querySelector(`${app} [data-scroll-container="directory"]`)?.textContent.includes('陈测试'),{},app);
 assert.deepEqual(errors,[]); console.log('PASS Chinese/numeric grouping, index selection and name search');
} finally {await context.close();await browser.close();}
