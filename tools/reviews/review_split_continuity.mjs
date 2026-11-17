// Disposable-profile regression for the user-confirmed desktop selection and fold continuity.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openPilotApp } from '../browser-automation/pilot_app_navigation.mjs';
import { resolveBrowserExecutable } from '../browser-automation/browser.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(path.join(root, 'foldmobilegym/package.json'));
const url = new URL(process.env.FOLDAGENT_REVIEW_URL || 'http://127.0.0.1:3188/');
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && !url.username && !url.password);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, 'artifacts/split-continuity-'));
const browser = await require('puppeteer').launch({headless:true, executablePath:resolveBrowserExecutable()});
const checks = [], failures = [], errors = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const title = '[data-app-id="reddit"] [data-action="create.title.input"]';
async function start(page) {
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({width:1440,height:1050}); await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__OS__ && window.__FOLDAGENT__);
  await page.evaluate(() => window.__FOLDAGENT__.setPosture('unfolded'));
  await openPilotApp(page,'reddit','/create'); await page.waitForSelector(title,{visible:true});
  await page.type(title,'Keep the original split draft');
  await page.evaluate(() => { document.activeElement?.blur(); window.__OS__.keyboard.hide();
    window.__splitTitle = document.querySelector('[data-app-id="reddit"] [data-action="create.title.input"]'); });
}
async function retained(page) {
  assert.equal(await page.$eval(title, el => el === window.__splitTitle && el.value === 'Keep the original split draft'),true);
  assert.equal(await page.evaluate(() => window.__OS__.getAppRoute('reddit').path),'/create');
}
async function diagonal(page) {
  const r = await (await page.$('[data-gesture-bar]')).boundingBox();
  await page.mouse.move(r.x+r.width/2,r.y+r.height-4); await page.mouse.down();
  await page.mouse.move(r.x+r.width*.22,r.y-240,{steps:12}); await page.mouse.up(); await wait(200);
}
async function run(name, fn) {
  const context = await browser.createBrowserContext(), page = await context.newPage();
  try { await start(page); await fn(page); checks.push(name); }
  catch(e) { failures.push({name,error:String(e.stack)}); await page.screenshot({path:path.join(output,`${name}-failure.png`)}); }
  finally { await context.close(); }
}
try {
  await run('real-desktop-selection',async page => {
    await diagonal(page);
    const picker = '[data-window-picker="split"]'; await page.waitForSelector(picker,{visible:true});
    assert.ok(await page.$(`${picker} [data-launcher="true"]`),'Second app must be chosen on the actual Launcher, not a custom half-screen app list');
    assert.equal(await page.$('.os-window-picker-grid'),null);
    const metrics=await page.$eval(picker,el=>({width:el.getBoundingClientRect().width,device:document.getElementById('root').getBoundingClientRect().width}));
    assert.ok(metrics.width > metrics.device*.9,'Desktop selection occupies the screen except the retained app edge');
    await page.screenshot({path:path.join(output,'desktop-selection.png')});
    await page.evaluate(() => window.__OS__.handleBack()); await page.waitForSelector(picker,{hidden:true}); await retained(page);
    await diagonal(page); await page.waitForSelector(picker,{visible:true});
    await page.click(`${picker} [data-window-selection-cancel]`); await page.waitForSelector(picker,{hidden:true}); await retained(page);
    await diagonal(page); await page.waitForSelector(picker,{visible:true});
    const source = await page.evaluate(() => window.__OS__.getState().activeTaskId);
    await page.click(`${picker} [data-launcher-app="clock"]`);
    await page.waitForFunction(() => window.__FOLDAGENT__.getState().multi_window.mode==='split');
    await retained(page);
    await page.evaluate(source => window.__OS__.launchTaskById(source), source);
    await diagonal(page); await page.waitForSelector(picker,{visible:true});
    await page.click(`${picker} button[aria-label="搜索"], ${picker} button[aria-label="Search"]`);
    await page.waitForSelector(`${picker} input[type="search"]`,{visible:true});
    await page.type(`${picker} input[type="search"]`,'Clock');
    await page.click(`${picker} [data-launcher-search-app="clock"]`);
    await page.waitForFunction(() => window.__FOLDAGENT__.getState().multi_window.mode==='split');
    await page.waitForSelector('[data-app-id="clock"] .clock-app-root',{visible:true}); await retained(page);
    assert.equal(await page.$(picker),null); assert.equal(await page.evaluate(()=>window.__OS__.getState().tasks.length),2);
    await page.evaluate(source => window.__OS__.launchTaskById(source), source);
    await diagonal(page); await page.waitForSelector(picker,{visible:true});
    await page.click(`${picker} [data-launcher-recents] [data-launcher-app="clock"]`);
    await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='split');
    assert.equal(await page.evaluate(()=>window.__OS__.getState().tasks.length),2,'Dock selection reuses the existing second task');
    await retained(page);
  });
  await run('folded-stacked-retention',async page => {
    const source=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
    await page.evaluate(()=>window.__OS__.launchApp('clock')); await page.waitForSelector('[data-app-id="clock"] .clock-app-root',{visible:true});
    const target=await page.evaluate(()=>window.__OS__.getState().activeTaskId);
    await page.evaluate(({source,target})=>window.__FOLDAGENT__.setMultiWindow('split',source,target,.55),{source,target});
    await wait(200);
    const before=await page.evaluate(()=>({ids:window.__OS__.getState().tasks.map(t=>[t.taskId,t.stack.map(a=>a.activityId)]),active:window.__OS__.getState().activeTaskId}));
    for(const posture of ['folded','unfolded','folded']) {
      await page.evaluate(p=>window.__FOLDAGENT__.setPosture(p),posture); await wait(250);
      const state=await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window);
      assert.equal(state.mode,'split','Folding must retain two tasks, not exit to fullscreen');
      assert.equal(state.primary_task_id,source); assert.equal(state.secondary_task_id,target); assert.equal(state.divider_ratio,.55);
      assert.deepEqual(await page.evaluate(()=>({ids:window.__OS__.getState().tasks.map(t=>[t.taskId,t.stack.map(a=>a.activityId)]),active:window.__OS__.getState().activeTaskId})),before);
      const a=await (await page.$('[data-app-id="reddit"][data-foldagent-pane="primary"]')).boundingBox();
      const b=await (await page.$('[data-app-id="clock"][data-foldagent-pane="secondary"]')).boundingBox();
      assert.ok(a&&b,'Both original activities remain visible');
      if(posture==='folded') { assert.ok(Math.abs(a.x-b.x)<2&&Math.abs(a.width-b.width)<2&&Math.abs(a.y+a.height-b.y)<2,'Cover form stacks top/bottom without gaps or overlap'); }
      else assert.ok(Math.abs(a.y-b.y)<2&&Math.abs(a.height-b.height)<2&&Math.abs(a.x+a.width-b.x)<2);
      await retained(page); await page.screenshot({path:path.join(output,`${posture}-split.png`)});
    }
    await page.click(title); await page.waitForSelector('[data-app-id="reddit"] [data-keyboard-active]');
    assert.equal(await page.$('[data-app-id="clock"] [data-keyboard-active]'),null);
    await page.evaluate(()=>{document.activeElement?.blur();window.__OS__.keyboard.hide();});
    const divider=await page.$('.foldagent-split-divider'),r=await divider.boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down(); await page.mouse.move(r.x+r.width/2,r.y+55,{steps:8}); await page.mouse.up();
    assert.ok((await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window.divider_ratio))>.58,'Folded divider changes vertical, not horizontal, ratio');
    await retained(page);
    const finalRatio = await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window.divider_ratio);
    await page.evaluate(()=>window.__FOLDAGENT__.setPosture('unfolded')); await wait(200);
    assert.equal(await page.evaluate(()=>window.__FOLDAGENT__.getState().multi_window.divider_ratio),finalRatio);
    await page.evaluate(()=>window.__FOLDAGENT__.setPosture('folded')); await wait(200);
    const movedDivider = await (await page.$('.foldagent-split-divider')).boundingBox();
    const rootRect = await (await page.$('#root')).boundingBox();
    await page.mouse.move(movedDivider.x+movedDivider.width/2,movedDivider.y+7); await page.mouse.down();
    await page.mouse.move(movedDivider.x+movedDivider.width/2,rootRect.y+5,{steps:10}); await page.mouse.up();
    await page.waitForFunction(()=>window.__FOLDAGENT__.getState().multi_window.mode==='fullscreen');
    assert.equal(await page.evaluate(()=>window.__OS__.getState().activeTaskId),target);
    assert.equal(await page.evaluate(()=>window.__OS__.getState().tasks.length),2,'Divider exit does not destroy either task');
    await page.evaluate(source=>window.__OS__.launchTaskById(source),source); await retained(page);
  });
  assert.deepEqual(errors,[]); assert.deepEqual(failures,[]);
} finally {
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:!failures.length&&!errors.length,checks,failures,errors},null,2));
  console.log(JSON.stringify({output,checks,failures,errors})); await browser.close();
}
