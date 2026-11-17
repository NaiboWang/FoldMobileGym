// Synthetic contact search continuity review. No real communications or private data.
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs'; import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'), frontend=fs.existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,frontend,'package.json')), url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3367/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const b=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}), errors=[];
const app='[data-app-id="contacts"]', dialog=`${app} [role="dialog"]`;
async function run(name,fn){const c=await b.createBrowserContext(),p=await c.newPage();p.on('pageerror',e=>errors.push(`${name}: ${e}`));try{await p.setViewport({width:1440,height:1100});await p.goto(url.href);await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);await fn(p);console.log('PASS',name)}finally{await c.close()}}
async function info(p){return p.evaluate(()=>{const u=new URL(window.__OS__.getAppRoute('contacts').path,'http://local');return {path:u.pathname,q:u.searchParams.get('q'),menu:u.searchParams.get('menu'),modal:u.searchParams.get('modal')}})}
async function waitInfo(p,expected){await p.waitForFunction(expected=>{const u=new URL(window.__OS__.getAppRoute('contacts').path,'http://local');return u.pathname===expected.path&&u.searchParams.get('q')===expected.q&&u.searchParams.get('menu')===expected.menu&&u.searchParams.get('modal')===expected.modal}, {},expected)}
const detail={path:'/contact/c_alice',q:'Alice',menu:null,modal:null}, menu={...detail,menu:'more'}, edit={...detail,path:'/contact/c_alice/edit'};
try{
 for(const posture of ['folded','unfolded']) for(const close of ['escape','system','cancel']) await run(`cold-menu-${posture}-${close}`,async p=>{
   await p.evaluate(x=>window.__FOLDAGENT__.setPosture(x),posture);await openPilotApp(p,'contacts','/contact/c_alice?q=Alice&menu=more');await p.waitForSelector(dialog,{visible:true});
   if(close==='escape')await p.keyboard.press('Escape');else if(close==='system')await p.evaluate(()=>window.__OS__.handleBack());else await p.click(`${dialog} [data-trigger="system.back"]`);
   await waitInfo(p,detail);await p.waitForSelector(dialog,{hidden:true});
 });
 await run('warm-menu-edit-save',async p=>{
   await p.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await openPilotApp(p,'contacts','/contact/c_alice?q=Alice');
   await p.click(`${app} [data-trigger="contact.menu.open"]`);await waitInfo(p,menu);await p.waitForSelector(dialog,{visible:true});
   await p.click(`${dialog} [data-trigger="contact.edit.open"]`);await waitInfo(p,edit);await p.waitForSelector(`${app} [data-action="contacts.edit.save.submit"]`,{visible:true});
   await p.click(`${app} [data-action="contacts.edit.save.submit"]`);await waitInfo(p,detail);assert.equal(await p.$eval(`${app} .contacts-directory-search`,e=>e.value),'Alice');
 });
 await run('cold-editor-dirty-discard',async p=>{
   await openPilotApp(p,'contacts','/contact/c_alice/edit?q=Alice');await p.waitForSelector(`${app} [data-contact-field="displayName"]`,{visible:true});
   await p.click(`${app} [data-contact-field="displayName"]`);await p.keyboard.type(' Test');await p.waitForFunction(app=>document.querySelector(`${app} [data-contact-field=displayName]`)?.value.includes('Test'),{},app);await p.evaluate(()=>window.__OS__.handleBack());await p.waitForFunction(()=>!window.__OS__.keyboard.getState().visible);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await p.evaluate(()=>window.__OS__.handleBack());await waitInfo(p,{...edit,modal:'discard'});await p.click(`${app} [data-action="contacts.edit.discard.submit"]`);await waitInfo(p,detail);
 });
 await run('directory-contact-switch-retains-filter',async p=>{
   await p.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await openPilotApp(p,'contacts','/contact/c_alice?q=Bob');
   await p.waitForFunction(app=>[...document.querySelectorAll(`${app} [data-trigger="contact.switch"]`)].some(e=>e.textContent.includes('Bob')),{},app);
   const handles=await p.$$(`${app} [data-trigger="contact.switch"]`);for(const h of handles){if((await h.evaluate(e=>e.textContent)).includes('Bob')){await h.click();break}}
   await waitInfo(p,{path:'/contact/c_bob',q:'Bob',menu:null,modal:null});assert.equal(await p.$eval(`${app} .contacts-directory-search`,e=>e.value),'Bob');
 });
 for(const orientation of ['side_by_side','stacked']) await run(`background-menu-${orientation}`,async p=>{
   await p.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await openPilotApp(p,'contacts','/contact/c_alice?q=Alice');await openPilotApp(p,'clock','/world');
   await p.evaluate(orientation=>{const tasks=window.__OS__.getState().tasks,contacts=tasks.find(t=>t.rootAppId==='contacts'),clock=tasks.find(t=>t.rootAppId==='clock');window.__FOLDAGENT__.setMultiWindow('split',contacts.taskId,clock.taskId,.5,null,.5,orientation);window.__OS__.launchTaskById(contacts.taskId)},orientation);
   await p.click(`${app} [data-trigger="contact.menu.open"]`);await waitInfo(p,menu);const retained=await p.$(`${dialog} [data-trigger="contact.edit.open"]`);
   await p.evaluate(()=>window.__OS__.launchTaskById(window.__OS__.getState().tasks.find(t=>t.rootAppId==='clock').taskId));await retained.evaluate(e=>e.click());await retained.dispose();assert.deepEqual(await info(p),menu);
 });
 assert.deepEqual(errors,[]);
}finally{await b.close()}
