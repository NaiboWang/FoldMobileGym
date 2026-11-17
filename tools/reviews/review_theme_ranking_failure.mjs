import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'); const frontend=['mobilegym','foldmobilegym'].find(x=>fs.existsSync(path.join(root,x,'package.json'))); const require=createRequire(path.join(root,frontend,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3233/'); assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync); assert.ok(executablePath);
const browser=await require('puppeteer').launch({headless:true,executablePath});
try {for(const posture of ['folded','unfolded']) for(const locale of ['zh-Hans','en']) for(const cold of [false,true]) {
 const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];let fail=cold;
 try {
  page.on('pageerror',e=>errors.push(e.message)); await page.setRequestInterception(true);
  page.on('request',r=>{const u=new URL(r.url()); if(r.method()!=='GET'||u.origin!==url.origin||u.pathname==='/api'||u.pathname.startsWith('/api/'))return void r.abort(); if(u.pathname==='/cdn/themes/manifest.json')return void r.respond(fail?{status:503,body:'unavailable'}:{status:200,contentType:'application/json',body:JSON.stringify({version:1,themes:[{id:'synthetic',title:'Synthetic'}],fonts:[],aod:[]})}); return void r.continue()});
  await page.setViewport({width:1440,height:1100}); await page.goto(url.href,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);window.__OS__.openApp('theme_store','/')},{locale,posture});
  const app='[data-app-id="theme_store"]'; await page.waitForSelector(app+' .theme-store-refresh',{visible:true}); await page.waitForFunction(s=>!document.querySelector(s+' .theme-store-reference-loading'),{},app);
  if(!cold) assert.ok(await page.$(app+' [data-theme-store-item="synthetic"]'));
  fail=true; await page.click(app+' [data-trigger="ranking.open"]');
  const notice=app+' .theme-store-ranking-scroll [data-theme-catalog-status]'; await page.waitForSelector(notice,{visible:true,timeout:2500});
  assert.equal(await page.$eval(notice,e=>e.textContent.trim()),cold?(locale==='en'?'Could not load theme resources. Refresh to retry.':'主题资源加载失败，请点击刷新重试。'):(locale==='en'?'Could not refresh. Showing the last loaded catalog.':'刷新失败，正在显示上次加载的内容。'));
  assert.equal(!!(await page.$(app+' [data-theme-rank="1"]')),!cold);
  fail=false; await page.click(app+' [data-action="themeStore.ranking.retry"]'); await page.waitForSelector(app+' [data-theme-rank="1"]'); assert.equal(await page.$(notice),null); assert.deepEqual(errors,[]);
  console.log('PASS',posture,locale,cold?'cold':'stale');
 } finally {await context.close()}
}
} finally {
 await browser.close();
}
