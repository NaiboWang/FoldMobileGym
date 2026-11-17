import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const require=createRequire(path.resolve(import.meta.dirname,'../package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}), checks=[];
try {
 for(const locale of ['zh-Hans','en']) for(const category of ['all','drinks']) for(const pointer of ['mouse','touch']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))return r.abort();return r.continue();});
  await page.setViewport({width:1440,height:1100,hasTouch:true});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(locale=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture('unfolded');},locale);
  await openPilotApp(page,'meituan_waimai','/');const app='[data-app-id="meituan_waimai"]',home=app+' .mt-super-home-pane',results=app+' .mt-super-results-pane';
  await page.waitForSelector(home+' .mt-super-recommendations .mt-shop-card',{visible:true});
  if(category==='drinks'){await page.click(home+' [data-trigger="meituan.home.category.drinks"]');await page.waitForFunction(()=>window.__OS__.getAppRoute('meituan_waimai')?.path.includes('category=drinks'));}
  const names=async()=>page.$$eval(home+' .mt-super-recommendations .mt-shop-card strong',els=>els.map(e=>e.textContent.trim()));
  const before=await names();assert.ok(before.length>0);
  await page.click(home+' [data-trigger="meituan.search.open"]');await page.waitForSelector(results,{visible:true});
  await page.waitForSelector(home+' .mt-super-recommendations .mt-shop-card',{visible:true,timeout:3000});assert.deepEqual(await names(),before);
  if(category==='all'){const cards=await page.$$eval(home+' .mt-super-recommendations .mt-shop-card',els=>els.slice(0,2).map(e=>{const r=e.getBoundingClientRect(),a=e.querySelector('.mt-shop-art').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,artWidth:a.width,artHeight:a.height};}));assert.equal(cards.length,2);assert.ok(cards[1].x>cards[0].x+cards[0].width*0.8&&Math.abs(cards[1].y-cards[0].y)<3,'unfolded retained home has two recommendation columns');assert.ok(cards.every(c=>c.artWidth>c.width*0.85&&c.artHeight>70),'recommendation tiles have an image-led layout');}
  const input=results+' input';await page.click(input);await page.type(input,'zz_no_match_926');
  await page.waitForFunction(()=>window.__OS__.getAppRoute('meituan_waimai')?.path.includes('zz_no_match_926'),{timeout:5000});
  assert.deepEqual(await names(),before);assert.equal(await page.$$eval(results+' .mt-shop-card',els=>els.length),0);
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await page.waitForFunction(sel=>!document.querySelector(sel)?.checkVisibility(),{},home);
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded'));await page.waitForSelector(home+' .mt-super-recommendations .mt-shop-card',{visible:true});assert.deepEqual(await names(),before);
  await page.$eval(home+' .mt-super-recommendations .mt-shop-card',el=>el.scrollIntoView({block:'center'}));await new Promise(resolve=>setTimeout(resolve,600));
  const selected=await page.$eval(home+' .mt-super-recommendations .mt-shop-card',el=>JSON.parse(el.getAttribute('data-trigger-params')).id);if(pointer==='touch')await page.tap(home+' .mt-super-recommendations .mt-shop-card');else await page.click(home+' .mt-super-recommendations .mt-shop-card');
  await page.waitForFunction(id=>window.__OS__.getAppRoute('meituan_waimai')?.path.startsWith('/shop/'+encodeURIComponent(id)),{timeout:5000},selected);
  await page.evaluate(()=>window.__OS__.handleBack());await page.waitForFunction(()=>window.__OS__.getAppRoute('meituan_waimai')?.path.includes('zz_no_match_926'),{timeout:5000});
  assert.deepEqual(errors,[]);checks.push({locale,category,pointer,homeRetained:true,searchIndependent:true,posture:true,openBack:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'local simulated home and search, no native content copied'}));
} finally {await browser.close();}
