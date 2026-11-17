import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {waitForVisibleImages, readVisibleImageHealth} from '../../tools/reviews/visible_images.mjs';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const require=createRequire(path.resolve(import.meta.dirname,'../package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3212/');
assert.ok(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const results=[], pageErrors=[], blocked={external:0,nonGet:0,localApi:0};
try {
 const context=await browser.createBrowserContext(),page=await context.newPage();
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.setRequestInterception(true);
 page.on('request',request=>{const u=new URL(request.url());if(request.method()!=='GET'){blocked.nonGet++;return request.abort();}if(u.origin!==url.origin&&!['data:','blob:'].includes(u.protocol)){blocked.external++;return request.abort();}if(u.origin===url.origin&&u.pathname.startsWith('/api/')){blocked.localApi++;return request.abort();}return request.continue();});
 await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__,{timeout:90000});
 const apps=await page.evaluate(()=>window.__SIM__.getState().os.installedApps.map(app=>app.id).filter(id=>!['app_picker','intent_chooser','permission_controller','package_installer'].includes(id)));
 assert.equal(apps.length,30);assert.equal(new Set(apps).size,apps.length);
 for(const posture of ['folded','unfolded']) {
  await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);
  await page.waitForFunction(value=>window.__FOLDAGENT__.getState().posture===value,{},posture);
  for(const id of apps){
   let result={id,posture,loaded:false,failedImages:0,overflow:false,errorBoundary:false};
   try {
    await page.evaluate(async value=>{window.__OS__.goHome();window.__OS__.openApp(value);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},id);
    await page.waitForFunction(value=>{const root=document.querySelector(`[data-app-id="${value}"]`);return window.__OS__.getState().activeAppId===value&&root&&root.getBoundingClientRect().width>0&&!root.querySelector('[data-app-launch-splash]')&&root.innerText.trim().length>0;},{timeout:45000},id);
    await page.evaluate(async value=>{let timer;try{await Promise.race([Promise.resolve(window.__SIM__.waitForData?.([value])),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Data readiness timed out")),30000);})]);}finally{clearTimeout(timer);}},id);
    await new Promise(resolve=>setTimeout(resolve,500));
    const selector=`[data-app-id="${id}"]`;
    const settlement=await waitForVisibleImages(page,selector);
    const imageHealth=await readVisibleImageHealth(page,selector);
    const state=await page.$eval(selector,root=>({overflow:root.scrollWidth>root.clientWidth+2,errorBoundary:/应用出现问题|Failed to fetch dynamically imported module/.test(root.innerText),unboundImageElements:[...root.querySelectorAll('img')].filter(image=>!image.currentSrc&&!image.getAttribute('src')).length}));
    result={...result,...state,loaded:true,imagesSettled:settlement.settled,visibleImages:imageHealth.imageCount,failedImages:imageHealth.failedImages.length};
   } catch(error) { result.problem=String(error).slice(0,180); }
   results.push(result);console.log(JSON.stringify({entry:result}));
   await page.evaluate(()=>window.__OS__.goHome());
  }
 }
 const failures=results.filter(item=>!item.loaded||!item.imagesSettled||item.overflow||item.errorBoundary||item.failedImages);
 const summary={passed:failures.length===0&&pageErrors.length===0,total:results.length,failures,pageErrorCount:pageErrors.length,blocked,scope:'isolated app entry diagnostic, intercepted page requests to external origins, local API and non-GET aborted; bound visible images only; unbound image elements are informational, no deep-flow, network service, benchmark or device-fidelity claim'};
 console.log(JSON.stringify({summary})); if(!summary.passed)process.exitCode=1;
 await context.close();
} finally {await browser.close();}
