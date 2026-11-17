import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const frontend=fs.existsSync(path.join(root,'mobilegym/package.json'))?'mobilegym':'foldmobilegym';
const require=createRequire(path.join(root,frontend,'package.json'));
const base=new URL(process.env.CLOCK_REVIEW_URL||'http://127.0.0.1:3224/');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)&&!base.username&&!base.password, 'review must use a credential-free local HTTP preview');
const executablePath=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await require('puppeteer').launch({headless:true,executablePath});
try {
 for(const locale of ['zh-Hans','en']) for(const posture of ['folded','unfolded']) {
  const context=await browser.createBrowserContext(); const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request',r=>{const u=new URL(r.url()); if(u.origin===base.origin && r.method()==='GET' && u.pathname!=='/api' && !u.pathname.startsWith('/api/'))r.continue();else r.abort();});
  await page.setViewport({width:1280,height:900}); await page.goto(base.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__OS__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);window.__OS__.openApp('clock','/timer');},{locale,posture});
  await page.waitForFunction(()=>window.__OS__.getAppRoute('clock')?.path==='/timer');
  const scope='[data-app-id="clock"] [data-clock-timer-phase="setup"]';
  await page.waitForSelector(`${scope} button[data-action="timer.setup.reset"]`,{visible:true});
  await page.click(`${scope} button[data-action="timer.setup.reset"]`);
  await page.waitForFunction(scope=>document.querySelector(`${scope} button[data-action="timer.run.start"]`)?.disabled,{},scope);
  const wheels=await page.$$(`${scope} .overflow-y-scroll.no-scrollbar`); assert.equal(wheels.length,3);
  const labels=locale==='en'?['Hours','Minutes','Seconds']:['小时','分钟','秒'];
  for(let i=0;i<wheels.length;i++) {
    assert.equal(await wheels[i].evaluate(e=>e.getAttribute('role')),'spinbutton');
    assert.equal(await wheels[i].evaluate(e=>e.getAttribute('aria-label')),labels[i]);
  }
  const scroll=async(index,delta)=>{const box=await wheels[index].boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel({deltaY:delta});await new Promise(r=>setTimeout(r,350));};
  await scroll(1,56); await scroll(2,112);
  const selected=await Promise.all(wheels.map(w=>w.$eval('.text-black.font-medium',e=>e.textContent)));
  assert.deepEqual(selected,['00','01','02'],`${locale} ${posture}: wheel values`);
  await wheels[1].focus();
  for(const [key,value] of [['Home','0'],['End','59'],['ArrowUp','0'],['ArrowDown','59'],['Home','0'],['ArrowUp','1']]) {
    await page.keyboard.press(key);
    await page.waitForFunction((el,value)=>el.getAttribute('aria-valuenow')===value,{},wheels[1],value);
  }
  await wheels[2].focus(); await page.keyboard.press('ArrowUp');
  await page.waitForFunction(el=>el.getAttribute('aria-valuenow')==='3',{},wheels[2]);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(el=>el.getAttribute('aria-valuenow')==='2',{},wheels[2]);
  const otherPosture=posture==='folded'?'unfolded':'folded';
  await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),otherPosture);
  await new Promise(r=>setTimeout(r,500));
  const afterFold=await Promise.all(wheels.map(w=>w.$eval('.text-black.font-medium',e=>e.textContent)));
  assert.deepEqual(afterFold,['00','01','02'],`${locale} ${posture}: selected duration after posture switch`);
  await page.click(`${scope} button[data-action="timer.run.start"]`);
  const expected=locale==='en'?'00:01:02 total':'共00:01:02';
  await page.waitForFunction(expected=>[...document.querySelectorAll('[data-clock-timer-total]')].some(e=>e.getBoundingClientRect().width>0&&e.textContent===expected),{},expected);
  const active='[data-app-id="clock"] [data-clock-timer-phase="running"]';
  await page.click(`${active} button[data-action="timer.run.pause"]`);
  await page.waitForSelector('[data-app-id="clock"] [data-clock-timer-phase="paused"]');
  assert.equal(await page.$eval('[data-clock-timer-total]',e=>e.textContent),expected);
  await page.evaluate(value=>window.__FOLDAGENT__.setPosture(value),posture);
  await page.click('[data-app-id="clock"] [data-clock-timer-phase="paused"] button[data-action="timer.run.resume"]');
  await page.waitForSelector(active); assert.equal(await page.$eval('[data-clock-timer-total]',e=>e.textContent),expected);
  await page.evaluate(()=>window.__OS__.openApp('clock','/alarm'));
  await page.waitForFunction(()=>window.__OS__.getAppRoute('clock')?.path==='/alarm');
  await page.click('[data-app-id="clock"] .clock-alarm-add');
  const editor='[data-clock-dialog="editor"]'; await page.waitForSelector(editor,{visible:true});
  const alarmWheels=await page.$$(`${editor} [role="spinbutton"]`); assert.equal(alarmWheels.length,2);
  assert.equal(await alarmWheels[0].evaluate(e=>e.getAttribute('aria-label')),labels[0]);
  assert.equal(await alarmWheels[1].evaluate(e=>e.getAttribute('aria-label')),labels[1]);
  await alarmWheels[0].focus();
  for(const [key,value] of [['End','23'],['ArrowUp','0'],['ArrowDown','23']]) {
    await page.keyboard.press(key);
    await page.waitForFunction((el,value)=>el.getAttribute('aria-valuenow')===value,{},alarmWheels[0],value);
  }
  assert.deepEqual(errors,[]); console.log(locale,posture,'timer mouse/keyboard, posture, pause/resume and alarm keyboard ->',expected);
  await context.close();
 }
} finally {await browser.close();}
