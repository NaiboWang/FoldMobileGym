import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});const output=fs.mkdtempSync(path.join(root,'artifacts/weather-unit-workflows-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()});const page=await browser.newPage(),checks=[],geometry=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
const app='[data-app-id="weather"]',dialog=`${app} [data-weather-unit-dialog]`,wait=ms=>new Promise(r=>setTimeout(r,ms));
const state=()=>page.evaluate(()=>window.__SIM__.getState().apps.weather);
const back=async()=>{await page.evaluate(()=>window.__OS__.handleBack());await wait(100)};
async function route(expected){await page.waitForFunction(expected=>window.__OS__.getAppRoute('weather').path===expected,{timeout:3000},expected)}
async function click(selector){await page.waitForSelector(selector,{visible:true});await page.click(selector)}
async function open(picker){await click(`${app} [data-trigger="settings.picker.${picker}.open"]`);await route('/settings?picker='+picker);await page.waitForSelector(dialog,{visible:true})}
const keyOf=picker=>picker==='temp'?'tempUnit':picker==='wind'?'windUnit':'pressureUnit';
const action=(picker,value)=>`${dialog} [data-action="settings.${keyOf(picker)}.select.${value}"]`;
async function bounds(posture,label){const row=await page.$eval(dialog,el=>{const d=el.querySelector('[role="dialog"]').getBoundingClientRect(),a=el.closest('[data-app-id]').getBoundingClientRect();return{dialog:{x:d.x,y:d.y,right:d.right,bottom:d.bottom},app:{x:a.x,y:a.y,right:a.right,bottom:a.bottom},inert:document.querySelector('[data-weather-settings-background]').inert,overflow:el.scrollWidth>el.clientWidth+1}});geometry.push({posture,label,...row});assert.equal(row.inert,true);assert.equal(row.overflow,false);assert.ok(row.dialog.x>=row.app.x-1&&row.dialog.right<=row.app.right+1&&row.dialog.y>=row.app.y-1&&row.dialog.bottom<=row.app.bottom+1);}
try{
 await page.setViewport({width:1440,height:1100});await page.goto(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3188/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SIM__&&window.__FOLDAGENT__);await openPilotApp(page,'weather','/');await page.waitForFunction(selector=>{const text=document.querySelector(selector)?.textContent.trim();return text&&text!=='--'}, {}, `${app} #view_speak_stub span`);
 const initial=await state(),city=initial.selectedCityId,initialCities=initial.savedCities,raw=initial.weatherLibrary?.[city]?.now?.temp;
 const homeTemp=Number(await page.$eval(`${app} #view_speak_stub span`,el=>el.textContent.trim()));assert.ok(Number.isFinite(homeTemp));
 await click(`${app} [data-trigger="menu.open"]`);await click(`${app} [data-trigger="settings.open"]`);await route('/settings');
 for(const posture of ['folded','unfolded']){
  await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);await wait(450);
  for(const picker of ['temp','wind','pressure']){
   const before=(await state()).settings;
   await page.evaluate(selector=>{const el=document.querySelector(selector);el.click();el.click()},`${app} [data-trigger="settings.picker.${picker}.open"]`);await route('/settings?picker='+picker);await bounds(posture,picker+' dialog');
   await page.focus(`${dialog} [role="radio"]`);for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[data-weather-settings-background]')),false,'Unit dialog must isolate keyboard focus from background')}
   await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture==='folded'?'unfolded':'folded');await wait(450);await route('/settings?picker='+picker);await back();await route('/settings');assert.deepEqual((await state()).settings,before,'Cancel is data-neutral and double open produced one entry');
   await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);await wait(450);
   const options=picker==='temp'?['celsius','fahrenheit']:picker==='wind'?['beaufort','kmh','ms','mph','kn']:['hpa','mmhg','inhg'];
   for(const value of options){await open(picker);await page.evaluate(selector=>{const button=document.querySelector(selector);button.click();button.click()},action(picker,value));await route('/settings');assert.deepEqual((await state()).settings,{...before,[keyOf(picker)]:value},'Selecting one actual unit changes only its own setting');}
   await open(picker);await page.screenshot({path:path.join(output,`${posture}-${picker}.png`)});await back();await route('/settings');
  }
  checks.push(`${posture}: real temperature/wind/pressure open and all 10 options, app containment, inert Tab background, duplicate open/submit, exact cancel/Back and posture retention`);
 }
 await open('temp');await click(action('temp','fahrenheit'));await route('/settings');await page.evaluate(()=>window.__OS__.locale.setLocale('en'));await open('pressure');assert.equal(await page.$eval(`${dialog} [role="dialog"]`,el=>el.getAttribute('aria-label')),'Pressure Unit');await back();await route('/settings');
 const saved=(await state()).settings;await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__SIM__?.getState().apps.weather);assert.deepEqual((await state()).settings,saved);await openPilotApp(page,'weather','/');await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.trim()!=='--',{},`${app} #view_speak_stub span`);
 const fahrenheit=Number(await page.$eval(`${app} #view_speak_stub span`,el=>el.textContent.trim()));assert.ok(Number.isFinite(fahrenheit));
 await openPilotApp(page,'weather','/settings');await open('temp');await click(action('temp','celsius'));await route('/settings');await openPilotApp(page,'weather','/');await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.trim()!=='--',{},`${app} #view_speak_stub span`);const celsius=Number(await page.$eval(`${app} #view_speak_stub span`,el=>el.textContent.trim()));assert.equal(fahrenheit,Math.round(celsius*9/5+32),'Actual home temperature consumes the selected unit, not just its settings label');
 checks.push('Actual English unit dialog, saved settings reload and home Fahrenheit/Celsius conversion are verified against the same selected city');
 await page.evaluate(()=>window.__OS__.closeApp('weather'));await wait(100);await openPilotApp(page,'weather','/settings?picker=wind');await back();await route('/settings');
 await page.setViewport({width:900,height:780});for(const posture of ['folded','unfolded']){await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);await wait(450);await open('wind');await bounds(posture,'narrow');await back();await route('/settings');}
 for(const [picker,key]of [['temp','tempUnit'],['wind','windUnit'],['pressure','pressureUnit']]){await open(picker);await click(action(picker,initial.settings[key]));await route('/settings');}await page.evaluate(()=>window.__OS__.locale.setLocale('zh-Hans'));
 const final=await state();assert.deepEqual(final.settings,initial.settings);assert.deepEqual(final.savedCities,initialCities);assert.equal(final.selectedCityId,city);assert.deepEqual(errors,[]);
 checks.push('Cold direct picker Back reconstructs settings rather than going Home; narrow dialogs remain contained, all original settings/city selections are restored');
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,checks,geometry,temperatures:{homeTemp,fahrenheit,celsius,raw},errors},null,2));console.log(JSON.stringify({passed:true,output,checks}));
}catch(error){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,checks,geometry,errors,error:String(error),stack:error.stack},null,2));console.error(JSON.stringify({passed:false,output,error:String(error)}));process.exitCode=1;}finally{await browser.close();}
