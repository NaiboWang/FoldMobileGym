// Capture only an isolated local simulator with built-in sample state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const output=path.resolve(process.env.FOLDAGENT_SHOWCASE_OUTPUT||path.join(root,'artifacts/readme-split-showcase'));
assert.ok(output.startsWith(path.join(root,'artifacts')+path.sep),'Output must stay inside artifacts');
assert.ok(!fs.existsSync(output),'Refuse to overwrite existing evidence');fs.mkdirSync(output,{recursive:true});
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
 await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await page.evaluate(()=>{window.__OS__.locale.setLocale('zh-Hans');window.__FOLDAGENT__.setPosture('unfolded');});
 await openPilotApp(page,'clock','/alarm');await page.waitForSelector('[data-app-id="clock"] .clock-alarm-add',{visible:true});
 const bar=await (await page.$('[data-gesture-bar]')).boundingBox();assert.ok(bar);
 await page.mouse.move(bar.x+bar.width/2,bar.y+bar.height-4);await page.mouse.down();await page.mouse.move(bar.x+bar.width*.22,bar.y-240,{steps:18});await page.mouse.up();
 const picker='[data-window-picker="split"]';await page.waitForSelector(picker,{visible:true});await page.click(`${picker} [data-launcher-app="calculator"]`);
 await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
 await page.waitForSelector('[data-app-id="calculator"]',{visible:true});await new Promise(r=>setTimeout(r,700));
 async function capture(name){const clip=await page.$eval('#root',node=>{const r=node.getBoundingClientRect(),p=12;return {x:Math.floor(r.x-p),y:Math.floor(r.y-p),width:Math.ceil(r.width+2*p),height:Math.ceil(r.height+2*p)}});assert.ok(clip.x>=0&&clip.y>=0&&clip.x+clip.width<=1440&&clip.y+clip.height<=1100);await page.screenshot({path:path.join(output,name),clip});}
 const unfolded=await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window);assert.equal(unfolded.split_orientation,'side_by_side');await capture('split-unfolded.png');
 await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await new Promise(r=>setTimeout(r,700));
 const folded=await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window);assert.equal(folded.mode,'split');assert.equal(folded.split_orientation,'stacked');await capture('split-folded.png');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,output,unfolded,folded,errors}));
} finally {await browser.close();}
