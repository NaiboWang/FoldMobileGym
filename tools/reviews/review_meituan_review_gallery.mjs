// Local disposable scenarios only. Synthetic optional reviews are not default data,
// task/judge changes or a claim that the full gallery was shown in the private video.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
fs.mkdirSync(path.resolve(import.meta.dirname, '../../artifacts'), { recursive: true });

const root=path.resolve(import.meta.dirname,'../..');
const require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3100/');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
const output=fs.mkdtempSync(path.join(root,'artifacts/meituan-gallery-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});
const checks=[],failures=[],errors=[];
const app='[data-app-id="meituan_waimai"]', modal=`${app} [data-meituan-review-lightbox]`, stage=`${modal} .mt-review-lightbox-stage`;
const close=`${modal} [data-trigger="system.back"]`, next=`${modal} [data-trigger="meituan.reviews.media.next"]`;
const thumb=`${app} [data-meituan-review-id="gallery-qa"] .mt-review-media-item`;
const owner='/shop/rice/reviews?origin=%2F&reviewFilter=media&trace=gallery';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const route=page=>page.evaluate(()=>window.__OS__.getAppRoute('meituan_waimai').path);
const state=page=>page.evaluate(()=>{const m=window.__SIM__.getState().apps.meituan_waimai;return{cart:m.cart,orders:m.orders,user:m.user};});
async function index(page,value){await page.waitForFunction(value=>new URLSearchParams(window.__OS__.getAppRoute('meituan_waimai').path.split('?')[1]).get('reviewMediaIndex')===String(value),{},value);}
async function prepare(page,locale='zh-Hans',posture='unfolded'){
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
 await openPilotApp(page,'meituan_waimai','/');
 await page.waitForSelector(`${app} img`);
 const image=await page.$eval(`${app} img`,e=>e.currentSrc||e.src);
 assert.equal(new URL(image).origin,url.origin);
 const shop=JSON.parse(fs.readFileSync(path.join(root,'foldmobilegym/apps/MeituanWaimai/data/shops.json'),'utf8')).find(s=>s.id==='rice');
 shop.reviews=[{id:'gallery-qa',author:'Synthetic reviewer',text:'Synthetic optional gallery source; not a default review.',rating:4,images:[1,2,3].map(n=>image+(image.includes('?')?'&':'?')+'gallery-qa='+n)}];
 await page.evaluate(async shop=>{await window.__SIM__.preloadAppStores(['meituan_waimai']);window.__SIM__.setState({apps:{meituan_waimai:{shops:{rice:shop}}}});},shop);
 await openPilotApp(page,'meituan_waimai',owner);await page.waitForSelector(thumb,{visible:true});return shop;
}
async function open(page){await page.click(thumb);await page.waitForSelector(modal,{visible:true});await index(page,0);await decoded(page);}
async function decoded(page){await page.waitForFunction(modal=>{const image=document.querySelector(modal+' .mt-review-lightbox-image img');return image?.complete&&image.naturalWidth>0;},{},modal);}
async function swipe(page,dx=-100,dy=0){const box=await(await page.$(stage)).boundingBox();const x=box.x+box.width*.55,y=box.y+box.height*.5;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:6});await page.mouse.up();}
async function caseRun(name,fn){const context=await browser.createBrowserContext(),page=await context.newPage();try{await fn(page);checks.push(name);}catch(e){failures.push({name,error:String(e.stack),route:await route(page).catch(()=>null)});await page.screenshot({path:path.join(output,name.replaceAll('/','-')+'-failure.png')}).catch(()=>{});}finally{await context.close();}}
try{
 for(const locale of ['zh-Hans','en'])for(const posture of ['unfolded','folded'])await caseRun(locale+'-'+posture,async page=>{
  await prepare(page,locale,posture);const before=await state(page);await page.focus(thumb);const scroll=await page.$eval(`${app} [data-scroll-container="menu"]`,e=>e.scrollTop);
  await open(page);
  assert.ok(await page.$eval(modal,e=>e.contains(document.activeElement)),'Initial modal focus');
  assert.equal(await page.$eval(`${app} [data-meituan-reviews-background]`,e=>e.inert),true);
  assert.equal(await page.$eval(`${modal} .mt-review-lightbox-nav`,e=>e.disabled),true);
  for(let i=0;i<5;i++){if(i%2)await page.keyboard.down('Shift');await page.keyboard.press('Tab');if(i%2)await page.keyboard.up('Shift');assert.ok(await page.$eval(modal,e=>e.contains(document.activeElement)));}
  await page.$eval(`${app} [data-trigger="meituan.shop.info"]`,e=>e.click());await index(page,0);
  await page.$eval(`${app} [data-trigger="meituan.cart.open"]`,e=>e.click());await index(page,0);
  await page.$eval(next,e=>{e.click();e.click();});await index(page,1);await decoded(page);
  await page.keyboard.press('ArrowRight');await index(page,2);await decoded(page);
  assert.equal(await page.$eval(`${modal} .mt-review-lightbox-nav:last-child`,e=>e.disabled),true);
  await page.keyboard.press('ArrowRight');await index(page,2);
  await page.keyboard.press('ArrowLeft');await index(page,1);await swipe(page,100);await index(page,0);
  await swipe(page,10,-100);await index(page,0);
  // Real native touch, not a direct callback or synthetic pointer event.
  const box=await(await page.$(stage)).boundingBox(),x=box.x+box.width*.65,y=box.y+box.height*.5;
  const cdp=await page.createCDPSession();await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*12,y}]});await wait(16);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await index(page,1);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
  await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),posture==='folded'?'unfolded':'folded');await index(page,1);await decoded(page);
  await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),posture);await index(page,1);
  await page.click(close);await page.waitForSelector(modal,{hidden:true});assert.equal(await route(page),owner);
  assert.equal(await page.$eval(`${app} [data-meituan-reviews-background]`,e=>e.inert),false);
  assert.ok(await page.$eval(thumb,e=>e===document.activeElement),'Thumbnail focus restored');
  assert.ok(Math.abs((await page.$eval(`${app} [data-scroll-container="menu"]`,e=>e.scrollTop))-scroll)<2,'Review scroll restored');
  await open(page);await page.keyboard.press('Escape');await page.waitForSelector(modal,{hidden:true});assert.equal(await route(page),owner);
  assert.deepEqual(await state(page),before,'Gallery leaves cart/orders/user unchanged');
  await page.screenshot({path:path.join(output,locale+'-'+posture+'-reviews.png')});
 });
 await caseRun('resize-and-background-cancel',async page=>{
  await prepare(page);await open(page);
  let box=await(await page.$(stage)).boundingBox(),x=box.x+box.width*.6,y=box.y+box.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.setViewport({width:1440,height:900});await page.mouse.move(x-100,y,{steps:6});await page.mouse.up();await wait(80);assert.equal(new URLSearchParams((await route(page)).split('?')[1]).get('reviewMediaIndex'),'0','Resize must cancel old swipe');
  await page.setViewport({width:1440,height:1100});box=await(await page.$(stage)).boundingBox();x=box.x+box.width*.6;y=box.y+box.height*.5;
  await page.evaluate(()=>window.__galleryTask=window.__OS__.getState().activeTaskId);await page.mouse.move(x,y);await page.mouse.down();await page.evaluate(()=>window.__OS__.goHome());await wait(60);await page.evaluate(()=>window.__OS__.launchTaskById(window.__galleryTask));await wait(60);await page.mouse.move(x-100,y,{steps:6});await page.mouse.up();await wait(80);assert.equal(new URLSearchParams((await route(page)).split('?')[1]).get('reviewMediaIndex'),'0','Background transition cancels swipe');
  await swipe(page);await index(page,1);
 });
 await caseRun('background-close-and-source-ownership',async page=>{
  const shop=await prepare(page);await open(page);const before=await state(page);
  await page.evaluate(modal=>{window.__oldGalleryClose=document.querySelector(modal+' [data-trigger="system.back"]');window.__oldGalleryNext=document.querySelector(modal+' [data-trigger="meituan.reviews.media.next"]');},modal);
  await openPilotApp(page,'clock','/alarm/new');const clock=await page.evaluate(()=>window.__OS__.getAppRoute('clock').path);
  await page.evaluate(()=>{window.__oldGalleryNext.click();window.__oldGalleryClose.click();});await wait(80);
  assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('clock').path),clock,'Background Close must not consume Clock Back');
  assert.equal(new URLSearchParams((await route(page)).split('?')[1]).get('reviewMediaIndex'),'0');
  await page.evaluate(()=>{const task=window.__OS__.getState().tasks.find(t=>t.rootAppId==='meituan_waimai');window.__OS__.launchTaskById(task.taskId);});await page.waitForSelector(modal,{visible:true});
  shop.reviews[0].images=[shop.reviews[0].images[0]];
  await page.evaluate(({shop,next})=>{const button=document.querySelector(next);window.__SIM__.setState({apps:{meituan_waimai:{shops:{rice:shop}}}});button.click();},{shop,next});await wait(80);await index(page,0);
  // Removing the source makes the request unavailable but must never trap Close.
  shop.reviews=[];await page.evaluate(shop=>window.__SIM__.setState({apps:{meituan_waimai:{shops:{rice:shop}}}}),shop);await page.waitForSelector(`${modal} [role="status"]`);assert.equal(await page.$(`${modal} img`),null);
  await page.click(close);await page.waitForSelector(modal,{hidden:true});assert.equal(await route(page),owner);assert.deepEqual(await state(page),before);
 });
 await caseRun('cold-invalid-and-orphan-requests',async page=>{
  await prepare(page);
  for(const params of ['reviewMedia=gallery-qa','reviewMediaIndex=0','reviewMedia=gallery-qa&reviewMediaIndex=01','reviewMedia=gallery-qa&reviewMediaIndex=0&reviewMediaIndex=1','reviewMedia=absent&reviewMediaIndex=0']){
   await openPilotApp(page,'meituan_waimai',owner+'&'+params);await page.waitForSelector(`${modal} [role="status"]`);assert.equal(await page.$(`${modal} img`),null);
   await page.click(close);await page.waitForSelector(modal,{hidden:true});assert.equal(await route(page),owner);
  }
  await openPilotApp(page,'meituan_waimai',owner+'&reviewMedia=gallery-qa&reviewMediaIndex=2');await decoded(page);await page.evaluate(()=>window.__OS__.handleBack());await page.waitForSelector(modal,{hidden:true});assert.equal(await route(page),owner);
 });
 await caseRun('closed-gallery-cart-remains-usable',async page=>{
  await prepare(page);const before=await state(page);await open(page);await page.click(close);await page.waitForSelector(modal,{hidden:true});
  await page.click(`${app} [data-trigger="meituan.shop.menu"]`);
  const add=`${app} [data-benchmark-dish-id="chicken"] [data-action="meituan.cart.item.add"]`;
  await page.waitForSelector(add,{visible:true});await page.click(add);await page.click(add);
  await page.waitForFunction(()=>window.__SIM__.getState().apps.meituan_waimai.cart.quantities.chicken===2);
  await page.click(`${app} [data-trigger="meituan.cart.open"]`);await page.waitForSelector(`${app} .mt-cart-row`,{visible:true});
  const remove=`${app} [data-action="meituan.cart.item.remove"]`;await page.click(remove);await page.click(remove);await page.waitForSelector(`${app} .mt-empty-cart`,{visible:true});
  assert.equal(await page.$eval(`${app} .mt-checkout button`,e=>e.disabled),true);
  const after=await state(page);assert.deepEqual(after.orders,before.orders);assert.deepEqual(after.user,before.user);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__);await openPilotApp(page,'meituan_waimai','/cart');await page.waitForSelector(`${app} .mt-empty-cart`,{visible:true});
 });
 await caseRun('real-system-split-isolation',async page=>{
  await prepare(page);await open(page);
  const bar=await(await page.$('[data-gesture-bar]')).boundingBox();await page.mouse.move(bar.x+bar.width/2,bar.y+bar.height-4);await page.mouse.down();await page.mouse.move(bar.x+bar.width*.22,bar.y-240,{steps:12});await page.mouse.up();
  const picker='[data-window-picker="split"]';await page.waitForSelector(picker,{visible:true});await page.click(`${picker} [data-launcher-app="clock"]`);await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
  await page.waitForSelector('[data-app-id="clock"] .clock-app-root',{visible:true});
  assert.equal(await page.$eval('[data-app-id="clock"]',e=>Boolean(e.closest('[inert]'))),false,'Sibling Clock is not inert');
  const clockTab='[data-app-id="clock"] [data-trigger="tab.world"]';await page.waitForSelector(clockTab,{visible:true});await page.click(clockTab);await page.waitForFunction(()=>window.__OS__.getAppRoute('clock')?.path==='/world');
  await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded'));await page.waitForFunction(()=>window.__FOLDAGENT__.getState().posture==='folded'&&window.__FOLDAGENT__.getState().multi_window.mode==='split');
  await page.waitForFunction(app=>{const a=document.querySelector(app)?.getBoundingClientRect(),b=document.querySelector('[data-app-id="clock"]')?.getBoundingClientRect();return a&&b&&Math.abs(a.x-b.x)<2&&Math.abs(a.width-b.width)<2&&Math.abs(a.y+a.height-b.y)<2;},{},app);
  await decoded(page);
  const geometry=await page.$eval(modal,e=>{const r=n=>{const b=e.querySelector(n).getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};return{image:r('.mt-review-lightbox-image img'),frame:r('.mt-review-lightbox-image'),counter:r('.mt-review-lightbox-counter')};});
  fs.writeFileSync(path.join(output,'split-gallery-geometry.json'),JSON.stringify(geometry,null,2));
  assert.equal(await page.$eval(`${modal} img`,e=>getComputedStyle(e).objectFit),'contain','Keep all source pixels rather than crop/cover the image');
  assert.ok(geometry.image.height<=geometry.frame.height+1&&geometry.image.bottom<=geometry.counter.y+1,'Complete photo remains within its stage, above the counter in a short split');await page.waitForSelector(modal,{visible:true});
  await page.screenshot({path:path.join(output,'real-folded-split.png')});
  await page.click(close);await page.waitForSelector(modal,{hidden:true});assert.equal(await route(page),owner);assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('clock').path),'/world','Closing the owning pane does not navigate its sibling');
 });
}finally{await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length&&!errors.length,checks,failures,errors,scope:'Functional local-gallery workflows, not complete native pixel/video certification'},null,2));}
console.log(JSON.stringify({output,checks,failures,errors}));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
