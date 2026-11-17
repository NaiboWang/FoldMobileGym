import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
const site=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(site.protocol==='http:'&&['127.0.0.1','localhost'].includes(site.hostname)&&!site.username&&!site.password);
const browser=await puppeteer.launch({headless:true,executablePath:resolveBrowserExecutable()});
const app='[data-app-id="meituan_waimai"]',checks=[];
try {
  for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) for(const pointer of ['mouse','touch']) {
    const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',r=>{const u=new URL(r.url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
    await page.setViewport({width:1440,height:1100,hasTouch:true});
    await page.goto(site.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
    await page.evaluate(({posture,locale})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{posture,locale});
    await openPilotApp(page,'meituan_waimai','/');
    const tap=async selector=>{await page.waitForSelector(selector,{visible:true});if(pointer==='mouse')await page.click(selector);else {const box=await (await page.$(selector)).boundingBox();assert.ok(box);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}};
    await tap(`${app} [data-meituan-service="delivery"]`);
    const title=locale==='en'?'Meituan · Food delivery':'美团 · 外卖频道';
    await page.waitForFunction(({app,title})=>window.__OS__.getAppRoute('meituan_waimai').path.includes('channel=waimai')&&document.querySelector(`${app} .mt-header b`)?.textContent.trim()===title,{}, {app,title});
    await tap(`${app} .mt-shop-card[data-trigger-params='{"id":"rice"}']`);
    await page.waitForFunction(()=>window.__OS__.getAppRoute('meituan_waimai').path.startsWith('/shop/rice'));
    await page.waitForSelector(`${app} [data-action="meituan.cart.item.add"]`,{visible:true});
    await tap(`${app} [data-action="meituan.cart.item.add"]`);
    await page.waitForFunction(()=>window.__SIM__.getState().apps.meituan_waimai.cart.quantities.chicken===1);
    await tap(`${app} [data-trigger="meituan.cart.open"]`);await page.waitForSelector(`${app} .mt-cart-row`,{visible:true});
    const state=await page.evaluate(()=>window.__SIM__.getState().apps.meituan_waimai);
    assert.equal(state.cart.shopId,'rice');assert.equal(state.cart.quantities.chicken,1);assert.equal(state.user.orderIds.length,0);
    assert.deepEqual(errors,[]);checks.push({posture,locale,pointer,cartPreserved:true});await context.close();
  }
  console.log(JSON.stringify({passed:true,url:site.href,checks}));
} finally {await browser.close();}
