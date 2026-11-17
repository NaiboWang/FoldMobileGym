import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {resolveBrowserExecutable} from '../../tools/browser-automation/browser.mjs';
const require=createRequire(path.resolve(import.meta.dirname,'../package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3201/');
assert.ok(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname) && !url.username && !url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[];
try {
 for(const viewport of [{width:1440,height:1100,deviceScaleFactor:1},{width:430,height:932,deviceScaleFactor:1},{width:1440,height:1100,deviceScaleFactor:2}]) {
  const context=await browser.createBrowserContext(), page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{const u=new URL(r.url());return r.method()==='GET'&&(u.origin===url.origin||['data:','blob:'].includes(u.protocol))?r.continue():r.abort();});
  await page.setViewport(viewport); await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__FOLDAGENT__&&window.__OS__);
  for(const posture of ['folded','unfolded']) {
   await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);
   await page.waitForFunction(value=>window.__FOLDAGENT__.getState().posture===value,{},posture);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.waitForFunction(()=>document.getElementById('root').getAnimations().length===0);
   const result=await page.evaluate(()=>{const root=document.getElementById('root'),style=getComputedStyle(root),box=root.getBoundingClientRect(); return {
    posture:window.__FOLDAGENT__.getState().posture, width:root.clientWidth,height:root.clientHeight,
    border:style.borderWidth,radius:style.borderRadius,outline:style.outlineWidth,outlineColor:style.outlineColor,
    outlineStyle:style.outlineStyle,shadow:style.boxShadow,overflow:style.overflow,camera:getComputedStyle(root,'::after').content,
    cssWidth:parseFloat(style.width),cssHeight:parseFloat(style.height),renderedWidth:box.width,renderedHeight:box.height,scale:Number(style.getPropertyValue('--sim-scale') || 1),
   };});
   const [width,height]=posture==='folded'?[402,900]:[831,900];
   assert.equal(result.width,width); assert.equal(result.height,height);
   assert.equal(result.border,'0px'); assert.equal(result.radius,'24px'); assert.equal(result.outline,'2px');
   assert.equal(result.outlineColor,'rgb(8, 8, 8)'); assert.equal(result.outlineStyle,'solid'); assert.equal(result.overflow,'hidden');
   assert.equal(result.shadow,'none'); assert.ok(['none','normal'].includes(result.camera));
   assert.ok(Math.abs(result.renderedWidth-result.cssWidth*result.scale)<0.2); assert.ok(Math.abs(result.renderedHeight-result.cssHeight*result.scale)<0.2);
   checks.push({viewport,posture,...result});
  }
  assert.deepEqual(errors,[]); await context.close();
 }
 console.log(JSON.stringify({passed:true,checks,scope:'computed screen outline and geometry; no native device parity or pixel-image comparison'}));
} finally {await browser.close();}
