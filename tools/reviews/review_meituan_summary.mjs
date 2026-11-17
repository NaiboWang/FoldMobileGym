// Merchant-summary hierarchy only; synthetic records, no real merchant service.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'),front=['foldmobilegym','mobilegym'].find(p=>fs.existsSync(path.join(root,p,'package.json')));
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath&&fs.existsSync(executablePath));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3432/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const output=fs.mkdtempSync(path.join(root,'artifacts/meituan-summary-')),browser=await require('puppeteer').launch({headless:true,executablePath}),checks=[],failures=[];
const app='[data-app-id="meituan_waimai"]',summary=`${app} [data-meituan-merchant-summary]`;
const shop={id:'summary-synthetic',name:'Synthetic merchant summary',rating:'4.6',sales:'1024 synthetic sales',time:'24 synthetic minutes',categoryId:'food',category:'Synthetic menu',dishes:[{id:'summary-dish',name:'Synthetic dish',price:11.25,note:'Synthetic source',emoji:'🍱'}]};
async function checkSummary(page){
 const metrics=await page.$$eval(`${summary} .mt-merchant-stats > div`,rows=>rows.map(row=>{const label=row.querySelector('small,dt'),value=row.querySelector('b,dd');return {label:label.textContent,value:value.textContent,labelBottom:label.getBoundingClientRect().bottom,valueTop:value.getBoundingClientRect().top,visible:label.checkVisibility()&&value.checkVisibility()&&label.getBoundingClientRect().height>0&&value.getBoundingClientRect().height>0,left:row.getBoundingClientRect().left,right:row.getBoundingClientRect().right};}));
 assert.equal(metrics.length,3);assert.deepEqual(metrics.map(row=>row.value),[shop.rating,shop.sales,shop.time]);
 for(const row of metrics)assert.ok(row.labelBottom<=row.valueTop+1,`Label ${row.label} must sit above source value ${row.value}`);
 assert.ok(metrics.every(row=>row.visible),'All terms and values must be visible');for(let i=1;i<metrics.length;i++)assert.ok(metrics[i].left>=metrics[i-1].right-1,'Statistics remain in three side-by-side columns');
 assert.equal(await page.$eval(`${summary} h1`,e=>e.textContent),shop.name);
}
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['folded','unfolded']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[],name=`${locale}-${posture}`;
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((u.origin===url.origin&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
   await page.evaluate(async({locale,posture,shop})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);await window.__SIM__.preloadAppStores(['meituan_waimai']);window.__SIM__.setState({apps:{meituan_waimai:{shops:{[shop.id]:shop},cart:{shopId:shop.id,quantities:{'summary-dish':2}}}}},{deep:true});window.__OS__.openApp('meituan_waimai',`/shop/${shop.id}?origin=%2F`);},{locale,posture,shop});
   await page.waitForSelector(summary,{visible:true});await page.waitForFunction(selector=>document.querySelector(selector+' h1')?.textContent==='Synthetic merchant summary',{},summary);
   const before=await page.evaluate(()=>structuredClone(window.__SIM__.getState().apps.meituan_waimai));
   await checkSummary(page);await page.screenshot({path:path.join(output,name+'-initial-synthetic.png')});await page.evaluate(()=>window.__FOLDAGENT__.setPosture(window.__FOLDAGENT__.getState().posture==='folded'?'unfolded':'folded'));
   await page.evaluate(()=>new Promise(r=>setTimeout(r,400)));await checkSummary(page);
   assert.deepEqual(await page.evaluate(()=>structuredClone(window.__SIM__.getState().apps.meituan_waimai)),before,'Viewing/reflow must not alter merchant/cart/order data');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await page.screenshot({path:path.join(output,name+'-after-switch-synthetic.png')});checks.push(name);console.log('PASS',name);
  }catch(e){failures.push({name,error:String(e.stack)});console.error('FAIL',name,String(e));}finally{await context.close();}
 }
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,checks,failures},null,2));}
console.log(JSON.stringify({passed:!failures.length,output,checks,failures}));if(failures.length)process.exitCode=1;
