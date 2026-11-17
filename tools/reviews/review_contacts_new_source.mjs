import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const frontend=fs.existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,frontend,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3381/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const app='[data-app-id="contacts"]', errors=[];
async function run(name,fn) {
 const context=await browser.createBrowserContext(),p=await context.newPage();p.on('pageerror',e=>errors.push(`${name}: ${e}`));
 try {await p.setViewport({width:1440,height:1100});await p.goto(url.href);await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);await p.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await fn(p);console.log('PASS',name)} finally {await context.close()}
}
const route=p=>p.evaluate(()=>window.__OS__.getAppRoute('contacts').path);
const back=p=>p.evaluate(()=>window.__OS__.handleBack());
const frame=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function openFromDetail(p){await openPilotApp(p,'contacts','/contact/c_alice');await p.click(`${app} .contacts-directory-fab`);await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts').path==='/contacts/new')}
try {
 await run('pristine-system-back-to-detail',async p=>{await openFromDetail(p);await back(p);await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts').path==='/contact/c_alice')});
 await run('dirty-discard-to-detail',async p=>{
   await openFromDetail(p);await p.type(`${app} [data-contact-field="displayName"]`,'Synthetic new contact');
   await back(p);await p.waitForFunction(()=>!window.__OS__.keyboard.getState().visible);await frame(p);await back(p);
   await p.waitForSelector(`${app} [role="alertdialog"]`,{visible:true});
   await p.click(`${app} [data-action="contacts.new.discard.submit"]`);
   await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts').path==='/contact/c_alice');
   assert.equal(await p.evaluate(()=>window.__OS__.content.query('content://contacts/contacts').items.some(c=>c.displayName==='Synthetic new contact')),false);
 });
 await run('save-to-detail-once',async p=>{
   await openFromDetail(p);await p.type(`${app} [data-contact-field="displayName"]`,'Synthetic new contact');
   await p.click(`${app} [data-action="contacts.new.save.submit"]`);
   await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts').path==='/contact/c_alice');
   assert.equal(await p.evaluate(()=>window.__OS__.content.query('content://contacts/contacts').items.filter(c=>c.displayName==='Synthetic new contact').length),1);
 });
 await run('favorites-source-system-back',async p=>{
   await openPilotApp(p,'contacts','/contacts?fav=true');
   await p.click(`${app} [data-trigger="contact.new.open"]`);
   await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts').path==='/contacts/new');
   await back(p);await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts').path==='/contacts?fav=true');
 });
 await run('cold-new-back-to-contacts',async p=>{await openPilotApp(p,'contacts','/contacts/new');await back(p);await p.waitForFunction(()=>window.__OS__.getAppRoute('contacts').path==='/contacts')});
 assert.deepEqual(errors,[]);
} finally {await browser.close()}
