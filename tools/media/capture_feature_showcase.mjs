// Capture local simulated screens only; no reference-video frames or personal profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const output=path.resolve(process.env.FOLDAGENT_SHOWCASE_OUTPUT||path.join(root,'artifacts/feature-showcase'));
const area=path.resolve(root,'artifacts');
assert.equal(fs.realpathSync(area),area,'Artifacts directory must not traverse links');
assert.equal(path.dirname(output),area,'Captures must use a direct artifacts child');
assert.ok(!fs.existsSync(output),'Refusing to overwrite previous captures');fs.mkdirSync(output,{recursive:true});
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
try {
 const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))return r.abort();return r.continue();});
 await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await page.evaluate(()=>{window.__SIM__.resetState();window.__OS__.locale.setLocale('zh-Hans');window.__FOLDAGENT__.setPosture('unfolded');});
 const app='[data-app-id="meituan_waimai"]';
 async function capture(name){await new Promise(r=>setTimeout(r,500));const clip=await page.$eval('#root',node=>{const r=node.getBoundingClientRect(),p=12;return {x:Math.floor(r.x-p),y:Math.floor(r.y-p),width:Math.ceil(r.width+2*p),height:Math.ceil(r.height+2*p)}});assert.ok(clip.x>=0&&clip.y>=0&&clip.x+clip.width<=1440&&clip.y+clip.height<=1100);await page.screenshot({path:path.join(output,name),clip});}
 await openPilotApp(page,'meituan_waimai','/?category=drinks');await page.waitForSelector(app+' [data-trigger="meituan.search.open"]',{visible:true});await page.click(app+' [data-trigger="meituan.search.open"]');
 await page.waitForSelector(app+' .mt-super-results-pane',{visible:true});await page.$eval(app+' .mt-super-recommendations',el=>{const scroller=el.closest('.mt-super-home-scroll');scroller.scrollTop+=el.getBoundingClientRect().top-scroller.getBoundingClientRect().top;});assert.equal(await page.$$eval(app+' img',els=>els.length),0,'No unreviewed artwork in showcase');await capture('meituan-search-workspace.png');
 await openPilotApp(page,'meituan_waimai','/shop/tea?origin=%2F%3Fcategory%3Ddrinks');await page.waitForSelector(app+' [data-meituan-shop-context="home"]',{visible:true});await page.$eval(app+' [data-meituan-shop-context="home"] .mt-super-recommendations',el=>{const scroller=el.closest('.mt-super-home-scroll');scroller.scrollTop+=el.getBoundingClientRect().top-scroller.getBoundingClientRect().top;});assert.equal(await page.$$eval(app+' img',els=>els.length),0,'No unreviewed artwork in showcase');await capture('meituan-merchant-workspace.png');
 await openPilotApp(page,'wechat_reading','/bookshelf');const shelf='[data-app-id="wechat_reading"]',progress=shelf+' [data-action="bookshelf.sort.select"][data-action-params=\'{"sort":"progress"}\']';
 await page.waitForSelector(progress+':not(:disabled)',{visible:true});await page.$eval(progress,el=>el.scrollIntoView({block:'nearest',inline:'center'}));await page.click(progress);await page.waitForFunction(sel=>document.querySelector(sel)?.getAttribute('aria-pressed')==='true',{},progress);assert.equal(await page.$$eval(shelf+' img',els=>els.length),0,'No unreviewed artwork in showcase');await capture('reading-progress-unfolded.png');
 await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await new Promise(r=>setTimeout(r,500));await capture('reading-progress-folded.png');
 assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({passed:true,output,files:['meituan-search-workspace.png','meituan-merchant-workspace.png','reading-progress-unfolded.png','reading-progress-folded.png'],scope:'isolated browser default simulated data, loopback GET only; not native parity or rights clearance'}));
} finally {await browser.close();}
