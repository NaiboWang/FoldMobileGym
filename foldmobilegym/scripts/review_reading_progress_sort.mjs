import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../../tools/browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const require=createRequire(path.resolve(import.meta.dirname,'../package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[];
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(r.method()!=='GET'||(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)))return r.abort();return r.continue();});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SIM__&&window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
  await openPilotApp(page,'wechat_reading','/bookshelf');
  const seeded=await page.evaluate(()=>{
    const current=window.__SIM__.getState().apps.wechat_reading;
    const books=current.store.filter(b=>typeof b.totalWords==='number'&&Number.isFinite(b.totalWords)&&b.totalWords>0).slice(0,3);
    if(books.length!==3)throw Error('Need three distinct simulated books with comparable totals');
    const ids=books.map(b=>String(b.id));if(new Set(ids).size!==3)throw Error('Need distinct book IDs');
    const shelf=ids.map(bookId=>({bookId,isPrivate:false,addedAt:'2020-01-01T00:00:00.000Z'}));
    const bookProgress=Object.fromEntries(books.slice(0,2).map((b,i)=>[String(b.id),{bookId:String(b.id),charOffset:b.totalWords*(i===0?.2:.8),lastReadAt:'2020-01-01T00:00:00.000Z'}]));
    window.__SIM__.setState({apps:{wechat_reading:{...current,shelf,bookProgress}}},{deep:false,reload:false});
    return {ids,shelf,bookProgress};
  });
  const app='[data-app-id="wechat_reading"]',cards=app+' [data-shelf-book-id]',button=app+' [data-action="bookshelf.sort.select"][data-action-params=\'{"sort":"progress"}\']';
  await page.waitForFunction((sel,ids)=>JSON.stringify([...document.querySelectorAll(sel)].map(n=>n.dataset.shelfBookId))===JSON.stringify(ids),{},cards,seeded.ids);
  await page.waitForSelector(button+':not(:disabled)',{visible:true});await page.$eval(button,n=>n.scrollIntoView({block:'nearest',inline:'center'}));await page.click(button);
  const ids=()=>page.$$eval(cards,n=>n.map(e=>e.dataset.shelfBookId));const expected=[seeded.ids[1],seeded.ids[0],seeded.ids[2]];
  await page.waitForFunction((sel,expected)=>JSON.stringify([...document.querySelectorAll(sel)].map(n=>n.dataset.shelfBookId))===JSON.stringify(expected),{},cards,expected);
  assert.equal(await page.$eval(button,n=>n.getAttribute('aria-pressed')),'true');
  assert.ok((await page.$eval(app+' [data-scroll-container="main"]',n=>n.scrollWidth<=n.clientWidth+2)));
  const text=await page.$eval(app,n=>n.innerText);assert.ok(text.includes(locale==='en'?'progress is estimated':'进度为本地估算'));
  const state=await page.evaluate(()=>{const {shelf,bookProgress}=window.__SIM__.getState().apps.wechat_reading;return {shelf,bookProgress};});assert.deepEqual(state,{shelf:seeded.shelf,bookProgress:seeded.bookProgress});
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture(window.__FOLDAGENT__.getState().posture==='folded'?'unfolded':'folded'));await new Promise(r=>setTimeout(r,450));assert.deepEqual(await ids(),expected);
  await page.click(app+' [data-trigger="bookshelf.select.enter.tap"]');await page.waitForSelector(app+' [data-trigger="bookshelf.select.exit"]',{visible:true});assert.equal(await page.$eval(button,n=>n.disabled),true);
  await page.click(app+' [data-trigger="bookshelf.select.exit"]');await page.waitForSelector(app+' [data-trigger="bookshelf.select.exit"]',{hidden:true});assert.deepEqual(await ids(),expected);
  await page.evaluate(({id})=>{const state=window.__SIM__.getState().apps.wechat_reading;const total=state.store.find(b=>String(b.id)===id).totalWords;const bookProgress={...state.bookProgress,[id]:{bookId:id,charOffset:total,lastReadAt:'2020-01-01T00:00:00.000Z'}};window.__SIM__.setState({apps:{wechat_reading:{...state,bookProgress}}},{deep:false,reload:false});},{id:seeded.ids[0]});
  await page.waitForFunction((sel,expected)=>JSON.stringify([...document.querySelectorAll(sel)].map(n=>n.dataset.shelfBookId))===JSON.stringify(expected),{},cards,seeded.ids);
  assert.deepEqual(errors,[]);await context.close();checks.push({locale,posture,sort:true,missingLast:true,liveUpdate:true,selectionAndPosture:true,stateUnchangedBySort:true});
 }
 console.log(JSON.stringify({passed:true,checks,scope:'synthetic local estimated reading progress, not native algorithm'}));
} finally {await browser.close();}
