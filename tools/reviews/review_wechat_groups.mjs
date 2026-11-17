// Local-only group creation and identity review. No invites, sends, AI or account calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {openPilotApp} from '../browser-automation/pilot_app_navigation.mjs';
import {resolveBrowserExecutable} from '../browser-automation/browser.mjs';
const root=path.resolve(import.meta.dirname,'../..'),require=createRequire(path.join(root,'foldmobilegym/package.json'));
const url=new URL(process.env.FOLDAGENT_REVIEW_URL||'http://127.0.0.1:3194/'),negative=process.env.FOLDAGENT_REVIEW_NEGATIVE==='1';
assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password);
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
const output=fs.mkdtempSync(path.join(root,'artifacts/wechat-groups-'));
const browser=await require('puppeteer').launch({headless:true,executablePath:resolveBrowserExecutable()}),checks=[],failures=[],errors=[],writes=[];
const app='[data-app-id="wechat"]',tick=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const state=page=>page.evaluate(()=>window.__SIM__.getState().apps.wechat);
try {for(const locale of negative?['en']:['zh-Hans','en']) for(const posture of negative?['unfolded']:['folded','unfolded']){
 const context=await browser.createBrowserContext(),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));await page.setRequestInterception(true);
 page.on('request',request=>{const address=new URL(request.url());if(!['GET','HEAD'].includes(request.method())||(['http:','https:'].includes(address.protocol)&&address.origin!==url.origin)){writes.push(request.method()+' '+address.origin);void request.abort();}else void request.continue();});
 try {
  await page.setViewport({width:1440,height:1100});await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__&&window.__FOLDAGENT__);
  await page.evaluate(({locale,posture})=>{window.__OS__.locale.setLocale(locale);window.__FOLDAGENT__.setPosture(posture);},{locale,posture});
  await openPilotApp(page,'wechat','/');const before=await state(page),peers=before.contacts.filter(contact=>!contact.isBlacklisted&&contact.wxid!==before.user.wxid).slice(0,2);
  assert.equal(peers.length,2);
  assert.ok(Number.isSafeInteger(before.sendCount), 'Expected real sendCount in simulator state');
  assert.equal(before.send_count,before.sendCount,'The send-count adapter must reflect the backing store');
  await openPilotApp(page,'wechat','/start-group');await tick(page);
  if(negative){
   for(const peer of peers)await page.evaluate(({app,name})=>{const node=[...document.querySelector(app).querySelectorAll('span')].find(node=>node.textContent===name);assertNode(node);node.parentElement.click();function assertNode(node){if(!node)throw Error('Missing source peer');}},{app,name:peer.name});
   await page.evaluate(app=>{window.__negativeDone=[...document.querySelector(app).querySelectorAll('button')].find(node=>node.textContent.trim().startsWith('Done'));if(!window.__negativeDone)throw Error('Missing Done');},app);
   const enabled=await page.evaluate(()=>!window.__negativeDone.disabled);assert.equal(enabled,true);
   await page.evaluate(()=>window.__negativeDone.click());await tick(page);
   const after=await state(page);assert.deepEqual(after.chats,before.chats);assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('wechat').path),'/start-group');
   await page.screenshot({path:path.join(output,'negative-done-no-effect.png')});checks.push({locale,posture,negative:'Two selected peers, enabled Done, no created chat and no navigation'});continue;
  }
  const done=`${app} [data-action="startGroup.create.submit"]`,boxes=`${app} [data-action="startGroup.members.item.toggle"]`;
  await page.waitForSelector(done,{visible:true});assert.equal(await page.$eval(done,node=>node.disabled),true);
  const select=async id=>{await page.evaluate(({boxes,id})=>{const node=[...document.querySelectorAll(boxes)].find(node=>JSON.parse(node.dataset.actionParams).wxid===id);if(!node)throw Error('Missing selected source');node.scrollIntoView({block:'center'});node.click();},{boxes,id});await tick(page);};
  await select(peers[0].wxid);await page.click(done);await page.waitForFunction(id=>window.__OS__.getAppRoute('wechat').path==='/chat/'+encodeURIComponent(id),{},peers[0].wxid);
  assert.deepEqual((await state(page)).chats,before.chats,'One selected peer opens existing direct chat, not a group');
  await openPilotApp(page,'wechat','/start-group');await page.waitForSelector(done,{visible:true});
  for(const peer of peers)await select(peer.wxid);
  // Isolated synthetic in-place ID mutation tests submission against the originally selected ID.
  await page.evaluate(({id,done})=>{const source=window.__SIM__.getState().apps.wechat.contacts.find(contact=>contact.wxid===id);if(!source)throw Error('Missing selected source');const original=source.wxid;try{source.wxid='synthetic-mutated-source-id';document.querySelector(done).click();}finally{source.wxid=original;}},{id:peers[0].wxid,done});
  await tick(page);assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('wechat').path),'/start-group');assert.deepEqual((await state(page)).chats,before.chats,'Mutated identity must not create or open a chat');
  // A retained Done callback must not operate from another foreground app.
  await page.$eval(done,node=>{window.__oldGroupDone=node;});await openPilotApp(page,'clock','/');await page.evaluate(()=>window.__oldGroupDone.click());await tick(page);assert.deepEqual((await state(page)).chats,before.chats);
  await openPilotApp(page,'wechat','/start-group');await page.waitForSelector(done,{visible:true});
  if(await page.$eval(done,node=>node.disabled))for(const peer of peers)await select(peer.wxid);
  await page.$eval(done,node=>{node.click();node.click();});await page.waitForSelector(`${app} textarea`,{visible:true});
  const created=await state(page),newGroups=created.chats.filter(chat=>!before.chats.some(old=>old.id===chat.id));assert.equal(newGroups.length,1);
  const group=newGroups[0],id=group.id;assert.equal(group.kind,'group');assert.equal(group.group.memberCount,3);assert.deepEqual(group.group.members.map(member=>member.wxid),[before.user.wxid,...peers.map(peer=>peer.wxid)]);assert.deepEqual(group.messages,[]);assert.deepEqual(created.contacts,before.contacts);assert.equal(created.send_count,before.send_count);assert.equal(created.sendCount,before.sendCount);assert.deepEqual(created.chatDrafts,before.chatDrafts);
  assert.equal(await page.$eval(`${app} [data-wechat-group-count]`,node=>node.textContent),'(3)');
  await page.click(`${app} textarea`);await page.keyboard.type('Synthetic unsent group draft');await page.evaluate(()=>window.__OS__.handleBack());await tick(page);assert.equal(await page.evaluate(()=>window.__OS__.getAppRoute('wechat').path),'/chat/'+encodeURIComponent(id));
  await page.evaluate(posture=>window.__FOLDAGENT__.setPosture(posture==='folded'?'unfolded':'folded'),posture);await tick(page);assert.equal(await page.$eval(`${app} textarea`,node=>node.value),'Synthetic unsent group draft');
  // Capture hit-testing and animation state for intermittent posture-transition failures;
  // this observes the real click without retrying it or weakening the assertion.
  await page.evaluate(selector=>{const node=document.querySelector(selector),rect=node?.getBoundingClientRect(),hit=rect&&document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);window.__groupClickDiagnostic={before:{rect:rect?.toJSON(),hitTag:hit?.tagName,hitTrigger:hit?.closest('[data-trigger]')?.getAttribute('data-trigger'),animations:document.getElementById('root')?.getAnimations({subtree:true}).map(a=>({playState:a.playState,currentTime:a.currentTime}))}};document.addEventListener('click',event=>{window.__groupClickDiagnostic.event={trusted:event.isTrusted,tag:event.target?.tagName,trigger:event.target?.closest?.('[data-trigger]')?.getAttribute('data-trigger')};},{capture:true,once:true});},`${app} [data-trigger="chatInfo.open"]`);
  await page.click(`${app} [data-trigger="chatInfo.open"]`);await page.waitForSelector(`${app} [data-wechat-chat-member]`,{visible:true});assert.deepEqual(await page.$$eval(`${app} [data-wechat-chat-member]`,nodes=>nodes.map(node=>node.dataset.wechatChatMember)),group.group.members.map(member=>member.wxid));await page.evaluate(()=>window.__OS__.handleBack());
  // Controlled presentation-only received messages, not default data/task/judge edits.
  await page.evaluate(({id,peers})=>{const s=window.__SIM__.getState().apps.wechat;window.__SIM__.setState({apps:{wechat:{chats:s.chats.map(chat=>chat.id===id?{...chat,messages:[...peers.map((peer,index)=>({id:'synthetic-group-'+index,type:'text',content:'Synthetic received text '+index,senderId:peer.wxid,timestamp:1000+index})),{id:'synthetic-unknown',type:'text',content:'Unknown sender text',senderId:'not-a-member',timestamp:2000}]}:chat)}}},{deep:true,reload:false});},{id,peers});
  await tick(page);const senderNames=await page.$$eval(`${app} [data-wechat-group-sender]`,nodes=>nodes.map(node=>node.textContent));assert.deepEqual(senderNames.slice(0,2),peers.map(peer=>peer.name));assert.equal(senderNames[2],locale==='en'?'Unknown member':'未知成员');
  for(let index=0;index<2;index++)assert.equal(await page.$eval(`${app} [data-message-id="synthetic-group-${index}"] img`,node=>node.getAttribute('src')),peers[index].avatar);
  assert.equal(await page.$(`${app} [data-message-id="synthetic-unknown"] img`),null);
  await page.screenshot({path:path.join(output,`${locale}-${posture}.png`)});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__OS__&&window.__SIM__);await openPilotApp(page,'wechat','/chat/'+encodeURIComponent(id));await page.waitForSelector(`${app} textarea`,{visible:true});assert.equal(await page.$eval(`${app} textarea`,node=>node.value),'Synthetic unsent group draft');assert.equal((await state(page)).chats.find(chat=>chat.id===id).group.memberCount,3);assert.equal((await state(page)).send_count,before.send_count);assert.equal((await state(page)).sendCount,before.sendCount);
  checks.push({locale,posture,id,members:3,senderNames,persisted:true,noSend:true});
 }catch(error){const diagnostic=await page.evaluate(()=>({click:window.__groupClickDiagnostic,route:window.__OS__?.getAppRoute("wechat")?.path,activeTag:document.activeElement?.tagName,animations:document.getElementById("root")?.getAnimations({subtree:true}).map(a=>({playState:a.playState,currentTime:a.currentTime}))})).catch(()=>null);failures.push({locale,posture,error:error.stack,diagnostic});await page.screenshot({path:path.join(output,`${locale}-${posture}-failure.png`)}).catch(()=>{});}finally{await context.close();}
 }}finally{await browser.close();}
const result={passed:!failures.length&&!errors.length&&!writes.length,negative,output,checks,failures,errors,writes};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
