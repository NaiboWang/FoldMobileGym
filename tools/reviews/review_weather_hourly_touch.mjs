import assert from 'node:assert/strict';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),front=existsSync(path.join(root,'foldmobilegym/package.json'))?'foldmobilegym':'mobilegym',require=createRequire(path.join(root,front,'package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3415/');assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname));
const b=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[];
try{for(const posture of ['folded','unfolded']){const context=await b.createBrowserContext(),p=await context.newPage();try{
 await p.setRequestInterception(true);p.on('request',r=>{const u=new URL(r.url());if((['localhost','127.0.0.1'].includes(u.hostname)&&['GET','HEAD'].includes(r.method()))||['data:','blob:'].includes(u.protocol))r.continue();else r.abort();});
 await p.setViewport({width:1440,height:1100,isMobile:true,hasTouch:true});await p.goto(url.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);await p.evaluate(posture=>window.__FOLDAGENT__.setPosture(posture),posture);await openPilotApp(p,'weather','/');
 const el=await p.waitForSelector('[data-app-id="weather"] [data-weather-hourly-scroll]');await el.evaluate(e=>e.scrollIntoView({block:'center'}));const r=await el.boundingBox(),client=await p.createCDPSession(),x=r.x+r.width*.8,y=r.y+r.height*.5;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*r.width*.07,y}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(resolve=>setTimeout(resolve,400));
 assert.ok(await el.evaluate(e=>e.scrollLeft)>0,'actual touch gesture scrolls hourly strip');assert.equal(await p.evaluate(()=>window.__OS__.getAppRoute('weather').path),'/');
 const next=posture==='folded'?'unfolded':'folded';await p.evaluate(next=>window.__FOLDAGENT__.setPosture(next),next);await p.waitForSelector('[data-app-id="weather"] [data-weather-hourly-kind="now"]');assert.equal(await p.evaluate(()=>window.__OS__.getAppRoute('weather').path),'/');checks.push(`${posture}: touch scroll and posture continuity`);console.log('PASS',posture);
 }finally{await context.close()}}}finally{await b.close()}console.log(JSON.stringify({passed:true,checks,scope:'Synthetic browser touch gesture and posture continuity, not hardware touch parity.'}));
