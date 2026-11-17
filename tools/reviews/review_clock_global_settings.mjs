// Disposable profiles, local simulator state and real UI clicks only. No real phone services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const front=['foldmobilegym','mobilegym'].find(name=>fs.existsSync(path.join(root,name,'package.json')));
const require=createRequire(path.join(root,front,'package.json'));
const release=fs.existsSync(new URL('../browser-automation/pilot_app_navigation.mjs',import.meta.url));
const {openPilotApp}=await import(release?'../browser-automation/pilot_app_navigation.mjs':'../../foldmobilegym/tools/pilot_app_navigation.mjs');
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3432/');
assert.ok(executablePath&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password);
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'artifacts/clock-global-settings-'));
const browser=await require('puppeteer').launch({headless:true,executablePath});
const app='[data-app-id="clock"]',pageSelector=app+' [data-clock-settings]',toggle=pageSelector+' [data-action="clock.settings.gradualVolume.toggle"]';
const menu=app+' [data-clock-global-menu]',checks=[],failures=[];
const route=page=>page.evaluate(()=>window.__OS__.getAppRoute('clock').path);
const core=page=>page.evaluate(()=>{const s=window.__SIM__.getState().apps.clock;return {alarms:s.alarms,cities:s.selectedCityIds};});
const preference=page=>page.evaluate(()=>window.__SIM__.getState().apps.clock.settings?.gradualVolume===true);
const wait=page=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,400)));
const modes=[
 {name:'folded-full',posture:'folded'},{name:'unfolded-full',posture:'unfolded'},
 {name:'folded-primary',posture:'folded',split:true,ratio:.5},{name:'folded-secondary',posture:'folded',split:true,ratio:.5,secondary:true},
 {name:'folded-short-primary',posture:'folded',split:true,ratio:.33},{name:'folded-short-secondary',posture:'folded',split:true,ratio:.67,secondary:true},
 {name:'unfolded-split',posture:'unfolded',split:true,ratio:.5},
 {name:'folded-floating',posture:'folded',floating:true},{name:'unfolded-floating',posture:'unfolded',floating:true},
];
async function prepare(page,mode,locale,target){
 await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
 await page.evaluate(locale=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture('unfolded');},locale);
 await openPilotApp(page,'clock',target);const task=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
 if(mode.split){await openPilotApp(page,'calculator');const other=await page.evaluate(()=>window.__OS__.getState().activeTaskId);await page.evaluate(({task,other,mode})=>window.__FOLDAGENT__.setMultiWindow('split',mode.secondary?other:task,mode.secondary?task:other,mode.ratio),{task,other,mode});}
 await page.evaluate(posture=>window.__FOLDAGENT__.setPosture(posture),mode.posture);
 if(mode.floating)await page.evaluate(task=>window.__FOLDAGENT__.setFloatingWindow(task,{x:.2,y:.12,width:.6,height:.35}),task);
 await wait(page);
}
async function openMenu(page){await page.click(app+' [data-trigger="alarm.menu.open"]');await page.waitForSelector(menu,{visible:true});assert.equal(await route(page),'/alarm?menu=more');}
async function openSettings(page){await openMenu(page);await page.click(menu+' [data-trigger="alarm.menu.settings.open"]');await page.waitForSelector(pageSelector,{visible:true});assert.equal(await route(page),'/settings');assert.equal(await page.$(menu),null);}
async function backToAlarm(page,visible=false){
 if(visible)await page.click(pageSelector+' [data-trigger="system.back"]');else await page.evaluate(()=>window.__OS__.handleBack());
 await page.waitForFunction(()=>window.__OS__.getAppRoute('clock').path==='/alarm');
 assert.equal(await page.$(menu),null);assert.equal(await page.evaluate(()=>window.__OS__.getState().isLauncherVisible),false);
}
async function checkSwitch(page){
 await page.$eval(toggle,e=>e.scrollIntoView({block:'center'}));
 const geometry=await page.$eval(toggle,e=>{const r=e.getBoundingClientRect(),p=e.closest('[data-app-id]').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:r.x>=p.x-1&&r.y>=p.y-1&&r.right<=p.right+1&&r.bottom<=p.bottom+1,hit:hit===e||e.contains(hit)};});
 assert.ok(geometry.inside&&geometry.hit);assert.equal(await page.evaluate(()=>window.scrollY),0);
}
async function captureClick(page,selector,key){await page.$eval(selector,(element,key)=>{const props=element[Object.keys(element).find(name=>name.startsWith('__reactProps$'))];if(!props?.onClick)throw Error('Missing actual React click handler');window[key]=()=>props.onClick({currentTarget:element,preventDefault(){},stopPropagation(){}});},key);}

try{
 for(const locale of ['zh-Hans','en'])for(const mode of modes){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],writes=[],tag=locale+'-'+mode.name;let phase='flow';
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const target=new URL(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if((target.origin===url.origin&&['GET','HEAD'].includes(r.method()))||['blob:','data:'].includes(target.protocol))r.continue();else r.abort();});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await prepare(page,mode,locale,'/alarm');
   const before=await core(page);assert.equal(await preference(page),false);
   const scroll=await page.$$eval(app+' [data-scroll-container="main"]',elements=>{const e=elements.find(e=>e.checkVisibility());e.scrollTop=120;return e.scrollTop;});
   await openMenu(page);assert.equal(await page.$$eval(menu+' button:disabled[data-trigger]',e=>e.length),0);
   const backdropFocus=app+' [data-clock-menu-layer] > button';
   await page.focus(backdropFocus);
   await page.evaluate(({alternate})=>window.__OS__.locale.setLocale(alternate),{alternate:locale==='en'?'zh-Hans':'en'});
   await page.waitForFunction((selector,label)=>document.querySelector(selector)?.getAttribute('aria-label')===label,{},backdropFocus,locale==='en'?'关闭更多菜单':'Close More menu');
   assert.equal(await page.$eval(backdropFocus,e=>document.activeElement===e),true,'Locale rerender must preserve the user’s focus');
   await page.evaluate(locale=>window.__OS__.locale.setLocale(locale),locale);
   await page.waitForFunction((selector,label)=>document.querySelector(selector)?.getAttribute('aria-label')===label,{},backdropFocus,locale==='en'?'Close More menu':'关闭更多菜单');
   assert.equal(await page.$eval(backdropFocus,e=>document.activeElement===e),true,'Restoring locale must preserve the user’s focus');
   await backToAlarm(page);
   await openSettings(page);await checkSwitch(page);assert.equal(await page.$eval(app+' [data-clock-background]',e=>e.checkVisibility()),false);
   await backToAlarm(page,true);
   assert.equal(await page.$$eval(app+' [data-scroll-container="main"]',elements=>elements.find(e=>e.checkVisibility()).scrollTop),scroll,'Returning from settings without resizing must preserve alarm scroll');
   await openSettings(page);await checkSwitch(page);
   assert.deepEqual(await core(page),before);await page.screenshot({path:path.join(output,tag+'-settings.png')});
   await captureClick(page,toggle,'__oldFalseSettingsClick');await page.click(toggle);await page.waitForFunction(()=>window.__SIM__.getState().apps.clock.settings?.gradualVolume===true);
   await page.evaluate(()=>window.__oldFalseSettingsClick());assert.equal(await preference(page),true,'An obsolete operand callback cannot undo a newer preference');
   await page.evaluate(selector=>{window.__settingsSwitch=document.querySelector(selector);},toggle);
   for(const posture of [mode.posture==='folded'?'unfolded':'folded',mode.posture]){await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),posture);await wait(page);assert.equal(await page.$eval(toggle,e=>e===window.__settingsSwitch),true);assert.equal(await preference(page),true);}
   await backToAlarm(page,true);
   const restored=await page.$$eval(app+' [data-scroll-container="main"]',elements=>{const e=elements.find(e=>e.checkVisibility());return {top:e.scrollTop,max:Math.max(0,e.scrollHeight-e.clientHeight)};});
   assert.equal(restored.top,Math.min(scroll,restored.max),'Returning after a posture change must retain the scroll position within the current bounds');
   await openSettings(page);assert.equal(await page.$eval(toggle,e=>e.getAttribute('aria-checked')), 'true');
   await page.reload({waitUntil:'domcontentloaded'});await prepare(page,mode,locale,'/settings');await page.waitForSelector(toggle,{visible:true});assert.equal(await preference(page),true,'Preference must survive a restart');
   await captureClick(page,toggle,'__backgroundSettingsClick');await openPilotApp(page,'calculator');await page.evaluate(()=>window.__backgroundSettingsClick());assert.equal(await preference(page),true);
   await openPilotApp(page,'clock','/settings');await page.evaluate(()=>window.__backgroundSettingsClick());assert.equal(await preference(page),true,'Old callbacks must not revive after foreground return');
   await checkSwitch(page);await page.click(toggle);await page.waitForFunction(()=>window.__SIM__.getState().apps.clock.settings?.gradualVolume===false);assert.deepEqual(await core(page),before);
   checks.push(tag+'-flow');console.log('PASS',tag+'-flow');

   phase='cold-settings';await page.reload({waitUntil:'domcontentloaded'});await prepare(page,mode,locale,'/settings');await page.waitForSelector(toggle,{visible:true});
   assert.equal(await preference(page),false);await backToAlarm(page,true);assert.deepEqual(await core(page),before);checks.push(tag+'-cold-settings');console.log('PASS',tag+'-cold-settings');

   phase='cold-menu';await page.reload({waitUntil:'domcontentloaded'});await prepare(page,mode,locale,'/alarm?menu=more');await page.waitForSelector(menu,{visible:true});
   await captureClick(page,menu+' [data-trigger="alarm.menu.settings.open"]','__oldMenuSettingsClick');
   // Split screen reserves the outside 20px (scaled to the canvas) for OS
   // edge gestures, including taps. Check that policy before testing the app.
   const backdrop=app+' [data-clock-menu-layer] > button';
   const box=await(await page.$(backdrop)).boundingBox();
   if(mode.split){
    const edge=await page.evaluate(({selector,y})=>{const root=document.querySelector('#root').getBoundingClientRect(),button=document.querySelector(selector);for(const x of [root.left+2,root.right-2])if(document.elementFromPoint(x,y)===button)return{x,y};return null;},{selector:backdrop,y:box.y+box.height*.7});
    assert.ok(edge,'A split-pane backdrop must reach one physical screen edge');
    await page.mouse.click(edge.x,edge.y);await wait(page);
    assert.equal(await route(page),'/alarm?menu=more','OS-reserved edge taps must not dismiss the menu');
    const other=await page.evaluate(()=>{const pane=document.querySelector('[data-app-id="calculator"]'),r=pane.getBoundingClientRect();for(const yf of [.35,.5,.7,.85])for(const xf of [.5,.3,.7]){const x=r.left+r.width*xf,y=r.top+r.height*yf,e=document.elementFromPoint(x,y);if(e&&pane.contains(e))return{x,y};}return null;});
    assert.ok(other,'The Calculator pane must be reachable');await page.mouse.click(other.x,other.y);
    await page.waitForFunction(()=>window.__OS__.getState().activeAppId==='calculator');
   }
   const point=await page.evaluate(({selector})=>{const b=document.querySelector(selector),r=b.getBoundingClientRect(),root=document.querySelector('#root'),outer=root.getBoundingClientRect(),edge=20*outer.width/root.offsetWidth;for(const yf of [.7,.8,.6])for(const xf of [.25,.4,.6,.75]){const x=r.left+r.width*xf,y=r.top+r.height*yf;if(x>outer.left+edge+2&&x<outer.right-edge-2&&document.elementFromPoint(x,y)===b)return{x,y};}return null;},{selector:backdrop});
   assert.ok(point,'The non-edge click must hit the visible menu backdrop');
   await page.mouse.click(point.x,point.y);
   await page.waitForFunction(()=>window.__OS__.getAppRoute('clock').path==='/alarm');await page.evaluate(()=>window.__oldMenuSettingsClick());assert.equal(await route(page),'/alarm');
   assert.deepEqual(await core(page),before);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.equal(await page.evaluate(()=>window.scrollY),0);
   checks.push(tag+'-cold-menu');console.log('PASS',tag+'-cold-menu');
  }catch(e){failures.push({name:tag+'-'+phase,error:String(e.stack),errors});console.error('FAIL',tag+'-'+phase,String(e));await page.screenshot({path:path.join(output,tag+'-failure.png')}).catch(()=>{});}
  finally{await context.close();}
 }
}finally{await browser.close();if(checks.length!==modes.length*2*3)failures.push({name:'coverage',error:`Expected ${modes.length*2*3} checks; got ${checks.length}`});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length,checks,failures},null,2));}
console.log(JSON.stringify({output,checks:checks.length,failures}));if(failures.length)process.exitCode=1;
