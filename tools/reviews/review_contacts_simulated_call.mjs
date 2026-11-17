import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {existsSync} from 'node:fs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym';
const require=createRequire(path.join(root,front,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(executablePath&&existsSync(executablePath));const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3422/');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath}),results=[],failures=[];
try{for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en']){
 const ctx=await browser.createBrowserContext(),page=await ctx.newPage(),errors=[],writes=[];
 try{
  page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort()});
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
  await page.evaluate(async({posture,locale})=>{window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);await window.__SIM__.preloadAppStores(['contacts']);window.__OS__.openApp('contacts','/?dialpad=true&number=123456789');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))},{posture,locale});
  await page.waitForSelector('[data-app-id="contacts"] .contacts-dialpad-call-primary');await page.click('[data-app-id="contacts"] .contacts-dialpad-call-primary');
  await page.waitForSelector('[data-app-id="contacts"] [data-simulated-call-screen]',{timeout:3000});
  const screen='[data-app-id="contacts"] [data-simulated-call-screen]';assert.ok((await page.$eval(screen,el=>el.textContent)).includes('123456789'));assert.ok((await page.$eval(screen,el=>el.textContent)).includes(locale==='en'?'Simulated':'模拟'));
  const labels=await page.$$eval(`${screen} .contacts-simulated-call-control`, els=>els.map(el=>el.querySelector('span')?.textContent??''));
  assert.deepEqual(labels,locale==='en'?['Record','AI answer','Add call','Video call','Mute','More','','','']:['录音','AI 接听','添加通话','视频通话','静音','更多','','','']);
  const controls=await page.$$eval(`${screen} .contacts-simulated-call-control button`, els=>els.map(el=>({label:el.getAttribute('aria-label'),disabled:el.disabled})));
  assert.equal(controls.length,9); assert.ok(controls.every((item,index)=>Boolean(item.label) && item.disabled === ![4,7,8].includes(index)));
  const mute=`${screen} [data-simulated-call-control="mute"]`,speaker=`${screen} [data-simulated-call-control="speaker"]`;
  await page.click(mute); await page.click(speaker);
  assert.equal(await page.$eval(mute,el=>el.getAttribute('aria-pressed')),'true');
  assert.equal(await page.$eval(mute,el=>el.getAttribute('aria-label'),),locale==='en'?'Muted (simulated)':'已静音（模拟）');
  assert.equal(await page.$eval(speaker,el=>el.getAttribute('aria-pressed')),'true');
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture(window.__FOLDAGENT__.getState().posture==='folded'?'unfolded':'folded'));await page.waitForSelector(screen);
  assert.equal(await page.$eval(mute,el=>el.getAttribute('aria-pressed')),'true'); assert.equal(await page.$eval(speaker,el=>el.getAttribute('aria-pressed')),'true');
  await page.click(mute); await page.click(speaker); assert.equal(await page.$eval(mute,el=>el.getAttribute('aria-pressed')),'false'); assert.equal(await page.$eval(speaker,el=>el.getAttribute('aria-pressed')),'false');
  await page.click(`${screen} [data-simulated-call-end]`);await page.waitForSelector('[data-app-id="contacts"] [data-benchmark-field="dialpad-digits"]');
  assert.equal((await page.$eval('[data-app-id="contacts"] [data-benchmark-field="dialpad-digits"]',el=>el.textContent)).trim(),'123456789');assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);results.push({posture,locale});console.log('PASS',posture,locale);
 }catch(e){failures.push({posture,locale,error:String(e)});console.error('FAIL',posture,locale,String(e))}finally{await ctx.close()}
}}finally{await browser.close()}console.log(JSON.stringify({passed:!failures.length,results,failures,scope:'Local simulated call UI, no network or real telephony.'}));if(failures.length)process.exitCode=1;
