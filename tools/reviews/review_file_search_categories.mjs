// Fresh browser contexts and synthetic simulator files only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const frontend=['mobilegym','foldmobilegym'].find(x=>fs.existsSync(path.join(root,x,'package.json')));
const require=createRequire(path.join(root,frontend,'package.json'));
const executablePath=process.env.FOLDAGENT_BROWSER_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium'].find(fs.existsSync);
assert.ok(executablePath);
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3217/');
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
const browser=await require('puppeteer').launch({headless:true,executablePath});
const checks=[],failures=[];
try {
 for(const posture of ['folded','unfolded'])for(const locale of ['zh-Hans','en']){
  const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
   page.on('request',r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.origin===url.origin&&u.pathname!=='/api'&&!u.pathname.startsWith('/api/'))r.continue();else r.abort()});
   await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__OS__&&window.__SIM_FS__&&window.__FOLDAGENT__);
   await page.evaluate(async ({posture,locale})=>{
    window.__FOLDAGENT__.setPosture(posture);window.__OS__.locale.setLocale(locale);
    for(const [name,mime] of [['synthetic-filter.txt','text/plain'],['synthetic-filter.pdf','application/pdf'],['synthetic-filter.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['synthetic-filter.zip','application/zip'],['synthetic-filter.apk','application/vnd.android.package-archive'],['synthetic-filter.bin','application/octet-stream']])
     await window.__SIM_FS__.write('/sdcard/'+name,'synthetic bytes',{mimeType:mime});
    window.__OS__.openApp('file_manager','/search?q=synthetic-filter&category=documents');
   },{posture,locale});
   const app='[data-app-id="file_manager"]',rows=app+' .fm-search-result';
   await page.waitForSelector(rows,{visible:true});
   const names=await page.$$eval(rows,els=>els.map(e=>e.querySelector('strong').textContent).sort());
   assert.deepEqual(names,['synthetic-filter.docx','synthetic-filter.pdf','synthetic-filter.txt']);
   for(const [category,expected] of [['archives',['synthetic-filter.zip']],['packages',['synthetic-filter.apk']],['all',['synthetic-filter.apk','synthetic-filter.bin','synthetic-filter.docx','synthetic-filter.pdf','synthetic-filter.txt','synthetic-filter.zip']]]) {
    const buttons=await page.$$(app+' [data-trigger="search.filter.switch"]');let chosen;
    for(const button of buttons){const params=await button.evaluate(el=>JSON.parse(el.getAttribute('data-trigger-params')||'{}'));if(params.category===category){chosen=button;break}}
    assert.ok(chosen,`Missing ${category} filter`);
    await chosen.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'center'}));await chosen.click();
    await page.waitForFunction(category=>new URLSearchParams(window.__OS__.getAppRoute('file_manager').path.split('?')[1]).get('category')===category,{},category);
    await page.waitForFunction(({rows,expected})=>{const names=[...document.querySelectorAll(rows)].map(e=>e.querySelector('strong').textContent).sort();return JSON.stringify(names)===JSON.stringify(expected)}, {}, {rows,expected});
    assert.equal(await page.$eval(app+' input',el=>el.value),'synthetic-filter');
   }
   assert.deepEqual(errors,[]);checks.push(`${posture}-${locale}`);console.log('PASS',posture,locale);
  }catch(e){failures.push(`${posture}-${locale}: ${String(e)}`);console.error('FAIL',posture,locale,String(e))}finally{await context.close()}
 }
}finally{await browser.close()}
console.log(JSON.stringify({checks,failures}));if(failures.length)process.exitCode=1;
