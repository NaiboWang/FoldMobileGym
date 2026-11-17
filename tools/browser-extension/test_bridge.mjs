import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./bridge.js',import.meta.url),'utf8');
const {controlPage}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function setup(url='http://127.0.0.1:3184/') {
  const calls=[], state={posture:'unfolded',multi_window:{mode:'fullscreen'}};
  globalThis.window={location:{href:url},__FOLDAGENT__:{getState:()=>state,setPosture:p=>{calls.push(['posture',p]);state.posture=p;},
    setMultiWindow:(...args)=>calls.push(['window',...args])},__OS__:{getState:()=>({tasks:['a','b','c'].map(id=>({taskId:id,rootAppId:id,stack:[{}]}))}),launchTaskById:id=>calls.push(['activate',id])}};
  return calls;
}
test('minimal permissions and no automatic/background injection',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url)));
 assert.deepEqual(manifest.permissions,['activeTab','scripting']);
 assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.background,undefined);assert.equal(manifest.content_scripts,undefined);
});
test('rejects remote, credentialed and unsupported scheme pages before any write',()=>{
 for(const url of ['https://example.com/','http://127.0.0.1.example.com/','http://u:p@localhost/','file:///test','https://localhost/']){
  const calls=setup(url);assert.equal(controlPage({kind:'posture',value:'folded'}).ok,false);assert.deepEqual(calls,[]);
 }
});
test('benchmark page permits read but rejects all writes',()=>{
 const calls=setup('http://localhost:3184/?foldagent_benchmark=1');
 assert.equal(controlPage({kind:'read'}).ok,true);
 assert.equal(controlPage({kind:'posture',value:'folded'}).ok,false);
 assert.equal(controlPage({kind:'window',mode:'fullscreen'}).ok,false);assert.deepEqual(calls,[]);
});
test('posture commands are explicit and unknown commands never write',()=>{
 const calls=setup();assert.equal(controlPage({kind:'posture',value:'folded'}).ok,true);
 assert.equal(controlPage({kind:'posture',value:'invalid'}).ok,false);
 assert.equal(controlPage({kind:'posture',value:'half_folded'}).ok,false);
 assert.equal(controlPage({kind:'unknown'}).ok,false);assert.deepEqual(calls,[['posture','folded']]);
});
test('split requires distinct current tasks, valid ratio and unfolded posture',()=>{
 const calls=setup();
 for(const request of [{tasks:['a','a'],ratio:.5},{tasks:['a','missing'],ratio:.5},{tasks:['a','b'],ratio:.8}]){
  assert.equal(controlPage({kind:'window',mode:'split',...request}).ok,false);
 }
 assert.deepEqual(calls,[]);
 assert.equal(controlPage({kind:'window',mode:'split',tasks:['a','b'],ratio:.6}).ok,true);
 assert.deepEqual(calls,[['activate','a'],['window','split','a','b',.6,null,.5]]);
 setup();window.__FOLDAGENT__.setPosture('folded');
 assert.equal(controlPage({kind:'window',mode:'split',tasks:['a','b'],ratio:.5}).ok,false);
});
test('triple uses three tasks and fullscreen does not open applications',()=>{
 const calls=setup();assert.equal(controlPage({kind:'window',mode:'triple',tasks:['a','b','c'],ratio:.5}).ok,true);
 assert.deepEqual(calls,[['activate','a'],['window','triple','a','b',.5,'c',.5]]);
 calls.length=0;assert.equal(controlPage({kind:'window',mode:'fullscreen'}).ok,true);
 assert.deepEqual(calls,[['window','fullscreen']]);
 delete globalThis.window;
});
