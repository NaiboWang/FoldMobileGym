import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {setBilibiliReviewLocale} from './bilibili_review_locale.mjs';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[];
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['folded','unfolded']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))r.abort();else r.continue();});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});await setBilibiliReviewLocale(page,locale,openPilotApp);
  await openPilotApp(page,'bilibili','/me');const initial=await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.favoritesFolders);const empty=initial.find(f=>!f.videoIds?.length),nonempty=initial.find(f=>f.videoIds?.length);assert.ok(empty&&nonempty);
  await openPilotApp(page,'bilibili','/favorites?tab=folders');const app='[data-app-id="bilibili"]',detail=`${app} .bili-favorites-detail`;
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-app-id="bilibili"] [data-trigger="favFolderDetail.open"]')].some(e=>e.checkVisibility()));
  const text=await page.$eval(detail,e=>e.innerText);assert.match(text,locale==='en'?/Favorites/:/收藏/);assert.match(text,locale==='en'?/Folders/:/收藏夹/);assert.match(text,locale==='en'?/\bitems?\b/:/个内容/);
  const article=`${detail} [data-trigger="favorites.tab.switch"][data-trigger-params='{"tab":"article"}']`;
  const bounds=await page.evaluate(({article,detail})=>{const a=document.querySelector(article).getBoundingClientRect(),d=document.querySelector(detail).getBoundingClientRect();return {articleRight:a.right,detailRight:d.right};},{article,detail});assert.ok(bounds.articleRight<=bounds.detailRight+1,'localized tab must fit its pane');await page.click(article);
  await page.waitForFunction(()=>new URL(window.__OS__.getAppRoute('bilibili').path,'http://localhost').searchParams.get('tab')==='article');assert.match(await page.$eval(detail,e=>e.innerText),locale==='en'?/No saved articles/:/暂无图文收藏/);
  for(const prefix of ['/favorites/folder/','/profile/fav/']){
   await openPilotApp(page,'bilibili',prefix+encodeURIComponent(empty.id));await page.waitForFunction(name=>[...document.querySelectorAll('[data-app-id="bilibili"] h1')].some(e=>e.checkVisibility()&&e.textContent===name),{},empty.title);
   let body=await page.$$eval(`${app} [data-scroll-container="main"]`,els=>els.filter(e=>e.checkVisibility()).map(e=>e.innerText).join(' '));assert.match(body,locale==='en'?/This folder is empty/:/收藏夹为空/);
   if(prefix==='/profile/fav/')assert.equal(await page.$$eval(`${app} button`,els=>els.some(e=>e.checkVisibility()&&e.disabled)),true);
   const visible=await page.evaluate(()=>[...document.querySelectorAll('[data-app-id="bilibili"]')].map(e=>e.innerText).join(' '));assert.match(visible,locale==='en'?/Created by/:/创建者/);
   await openPilotApp(page,'bilibili',prefix+encodeURIComponent(nonempty.id));await page.waitForFunction(name=>[...document.querySelectorAll('[data-app-id="bilibili"] h1')].some(e=>e.checkVisibility()&&e.textContent===name),{},nonempty.title);
  }
  assert.deepEqual(await page.evaluate(()=>window.__SIM__.getState().apps.bilibili.user.favoritesFolders),initial);assert.deepEqual(errors,[]);checks.push({locale,posture,labels:true,empty:true,folderIdentity:true,stateUnchanged:true});await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'localized UI labels only; fixture titles and other apps not translated or changed'}));
}finally{await browser.close();}
