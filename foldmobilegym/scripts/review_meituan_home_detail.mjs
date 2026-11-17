import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import puppeteer from 'puppeteer';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
import {attachReadOnlyBuildPage} from './lib/readOnlyBuildPage.mjs';
const url=process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3188/';
const targetURL=new URL(url);assert.ok(targetURL.protocol==='http:'&&['localhost','127.0.0.1'].includes(targetURL.hostname)&&!targetURL.username&&!targetURL.password);
const root=path.resolve(import.meta.dirname,'../..');
if(!process.env.FOLDAGENT_REVIEW_OUTPUT)fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
const out=process.env.FOLDAGENT_REVIEW_OUTPUT||fs.mkdtempSync(path.join(root,'artifacts/meituan-home-detail-'));
fs.mkdirSync(out,{recursive:true});const browser=await puppeteer.launch({headless:true,executablePath:resolveBrowserExecutable()}),page=await browser.newPage();
const app='[data-app-id="meituan_waimai"]',home=app+' [data-meituan-shop-context="home"]',checks=[],errors=[];
const wait=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const route=()=>page.evaluate(()=>window.__OS__.getAppRoute('meituan_waimai').path);
const back=async()=>{await page.evaluate(()=>window.__OS__.handleBack());await wait();};
page.on('pageerror',e=>errors.push(e.message));
let transport={mode:'not-initialized',delivered:[],blocked:[]};
try{
  transport=await attachReadOnlyBuildPage(page,{directory:process.env.FOLDAGENT_REVIEW_BUILD,workspace:path.resolve(import.meta.dirname,'../..'),baseURL:url});
 await page.setViewport({width:1440,height:1100});await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__OS__&&window.__SIM__);await page.evaluate(()=>window.__SIM__.resetState());await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__);
 await page.evaluate(()=>{window.__FOLDAGENT__.setPosture('unfolded');window.__OS__.openApp('meituan_waimai','/');});
 await page.waitForSelector(app+' .mt-super-home-scroll',{visible:true});
 const before=await page.evaluate(()=>window.__SIM__.getState().apps.meituan_waimai);
 const card=app+' .mt-shop-card[data-trigger-params*=rice]';
 await page.$eval(card,n=>n.scrollIntoView({block:'center'}));await wait();
 const originalOffset=await page.$eval(app+' .mt-super-home-scroll',n=>n.scrollTop);assert.ok(originalOffset>0,'Real homepage is scrolled before opening its merchant');
 await page.click(card);await page.waitForSelector(app+' .mt-menu-tabs',{visible:true});
 assert.ok(await page.$(home),'Home recommendation must retain the actual home surface, not replace it with search results or a full-width merchant');
 assert.equal(await page.$$eval(home+' [data-meituan-service]',n=>n.length),15);
 assert.equal(await page.$$eval(home+' .mt-super-tabbar button',n=>n.length),5);
 const verifyHomeGrid=async()=>{const cards=await page.$$eval(home+' .mt-super-recommendations .mt-shop-card',els=>els.slice(0,2).map(e=>{const r=e.getBoundingClientRect(),a=e.querySelector('.mt-shop-art').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,artWidth:a.width,artHeight:a.height};}));assert.equal(cards.length,2);assert.ok(cards[1].x>cards[0].x+cards[0].width*0.8&&Math.abs(cards[1].y-cards[0].y)<3,'retained homepage should show two recommendation columns');assert.ok(cards.every(c=>c.artWidth>c.width*.85&&c.artHeight>70),'retained recommendations should have image-led tiles');};
 await verifyHomeGrid();
 const detail=await route();assert.equal(new URLSearchParams(detail.split('?')[1]).get('origin'),'/');
 await page.evaluate(()=>window.__homeContextOwner=document.querySelector('[data-meituan-shop-context="home"]'));
 for(const mode of ['folded','unfolded']){
  await page.evaluate(v=>window.__FOLDAGENT__.setPosture(v),mode);await new Promise(r=>setTimeout(r,420));
  assert.equal(await route(),detail);assert.equal(await page.$eval(home,n=>n.checkVisibility()),mode==='unfolded');
  assert.equal(await page.$eval(home,n=>n===window.__homeContextOwner),true);
  await page.screenshot({path:path.join(out,mode+'.png')});checks.push({mode,homeAndDetailRetained:true});
 }
 for(const id of ['reviews','info']){await page.click(app+' [data-trigger="meituan.shop.'+id+'"]');await wait();assert.equal(new URLSearchParams((await route()).split('?')[1]).get('origin'),'/');}
 await back();await page.waitForSelector(app+' .mt-super-home-scroll',{visible:true});assert.equal(await route(),'/');
 const restored=await page.$eval(app+' .mt-super-home-scroll',n=>n.scrollTop);assert.ok(Math.abs(restored-originalOffset)<3,'Back restores homepage scroll, not the top');
 assert.deepEqual(await page.evaluate(()=>window.__SIM__.getState().apps.meituan_waimai),before);
 checks.push({homeBack:true,originalOffset,restored,businessStateUnchanged:true});
 // The retained homepage must contain live controls, not a copied image.
 await page.click(card);await page.waitForSelector(home,{visible:true});
 await page.click(home+' [data-trigger="meituan.search.open"]');
 await page.waitForSelector(app+' .mt-search input',{visible:true});
 assert.equal(await route(),'/?search=open');
 await back();await page.waitForSelector(home,{visible:true});
 await page.$eval(home+' .mt-super-home-scroll',n=>n.scrollTop=0);await wait();
 await page.click(home+' [data-meituan-service="travel"]');
 await page.waitForSelector(app+' .mt-main-service-scope',{visible:true});assert.equal(await route(),'/service/travel');
 await back();await page.waitForSelector(home,{visible:true});
 checks.push({leftSearchAndServiceWork:true});
 await page.evaluate(()=>window.__OS__.closeApp('meituan_waimai'));await page.waitForSelector(app,{hidden:true});
 await page.evaluate(()=>window.__OS__.openApp('meituan_waimai','/shop/rice?origin=%2F'));
 await page.waitForSelector(home,{visible:true});
 for(const locale of ['en','zh-Hans']){
  await page.evaluate(l=>window.__OS__.locale.setLocale(l),locale);await wait();
  assert.equal(await route(),'/shop/rice?origin=%2F');
  assert.equal(await page.$$eval(home+' [data-meituan-service]',n=>n.length),15);
  await verifyHomeGrid();
 }
 const sibling=home+' .mt-super-recommendations .mt-shop-card[data-trigger-params*=salad]';
 await page.$eval(sibling,n=>n.scrollIntoView({block:'center'}));await wait();await page.click(sibling);
 await page.waitForFunction(()=>window.__OS__.getAppRoute('meituan_waimai').path.startsWith('/shop/salad'));
 assert.equal(new URLSearchParams((await route()).split('?')[1]).get('origin'),'/');assert.equal(await page.$eval(home,n=>n.checkVisibility()),true);
 await back();await page.waitForSelector(app+' .mt-super-home-scroll',{visible:true});assert.equal(await route(),'/');
 assert.deepEqual(await page.evaluate(()=>window.__SIM__.getState().apps.meituan_waimai),before);
 checks.push({coldHomeOrigin:true,bilingualHomeSource:true,siblingTileWorks:true});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,transportMode:transport.mode,checks,errors},null,2));console.log(JSON.stringify({passed:true,transportMode:transport.mode,checks,out}));
}catch(e){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:false,error:String(e.stack),checks,errors},null,2));throw e;}finally{if(out) fs.writeFileSync(path.join(out,'transport.json'),JSON.stringify(transport,null,2)); await browser.close();}
