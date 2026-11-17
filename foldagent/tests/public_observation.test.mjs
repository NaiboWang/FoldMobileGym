import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readInstalledApps,normalizeInstalledApps,publicActionResult} from '../public_observation.mjs';
import {modelMessages} from '../prompts.mjs';
import {buildRequest} from '../api.mjs';

const apps=[{id:'notes',name:'笔记'},{id:'calendar',name:'日历'}];
const privateMarker='PRIVATE_DOM_JUDGE_ANSWER_SENTINEL';

test('Public directory reads only installed app names/IDs and strips extra fields',async()=>{
  const state={os:{installedApps:apps.map(app=>({...app,contents:privateMarker}))}};
  Object.defineProperty(state,'apps',{get(){throw Error('App contents must not be read');}});
  const projected=await readInstalledApps({eval:async expression=>vm.runInNewContext(expression,{window:{__SIM__:{getState:()=>state}}})});
  assert.deepEqual(projected,[apps[1],apps[0]]);
  assert.equal(JSON.stringify(projected).includes(privateMarker),false);
  assert.throws(()=>normalizeInstalledApps(null),/unavailable/);
  assert.throws(()=>normalizeInstalledApps([]),/unavailable/);
  assert.throws(()=>normalizeInstalledApps([{id:'bad id',name:'Bad'}]),/Invalid entry/);
});

test('Missing apps and installed-but-not-ready apps get distinct public errors',()=>{
  for(const text of ['Keep','Google Keep']) {
    const result=publicActionResult({action:'open',text},{id:'agent.open_app_failed',valid:false,params:{route:privateMarker}},apps);
    assert.equal(result.code,'app_not_installed');assert.match(result.message,/不存在/);assert.ok(result.message.includes(text));
    assert.equal(JSON.stringify(result).includes(privateMarker),false);
  }
  for(const text of ['notes','Notes','笔记']) {
    const result=publicActionResult({action:'open',text},{id:'agent.open_app_failed',valid:false},apps);
    assert.equal(result.code,'app_open_failed');assert.match(result.message,/已安装/);
  }
});

test('Feedback never forwards DOM identifiers, targets, exception strings or evaluator fields',()=>{
  const records=[
    {id:'chat.draft.input',valid:true,expected:'executed'},
    {id:'agent.execution_error',valid:false,expected:'execution_error'},
    {id:'agent.no_editable_focus',valid:false,expected:'no_editable_focus'},
    {id:privateMarker,valid:false,expected:'action_failed'},
  ];
  for(const record of records) {
    const feedback=publicActionResult({action:'type',text:'hello'},{...record,target:privateMarker,
      params:{error:privateMarker,route:privateMarker,visible_controls:privateMarker,benchmark_field:privateMarker},
      passed:true,fired_events:[privateMarker],answer:privateMarker},apps);
    assert.equal(feedback.code,record.expected);
    assert.equal(JSON.stringify(feedback).includes(privateMarker),false);
    assert.deepEqual(Object.keys(feedback).sort(),['code','message','status']);
  }
});

test('Both API transports receive the directory and failed action feedback even without image history',()=>{
  const action={action:'open',text:'Keep'};
  const result=publicActionResult(action,{id:'agent.open_app_failed',valid:false},apps);
  const history=[{step:1,summary:JSON.stringify(action),response:JSON.stringify(action),screenshot:'old',public_result:result,
    benchmark_action:{target:privateMarker},passed_after_step:true,fired_events:[privateMarker]}];
  for(const api of ['responses','chat-completions'])for(const visionHistory of [0,1]) {
    const messages=modelMessages({promptVersion:'v4',installedApps:apps,visionHistory},'Read the calendar',history,'current');
    const request=buildRequest({api,model:'mock',promptVersion:'v4',maxOutputTokens:4096},messages);
    const instructions=api==='responses'?request.instructions:request.messages[0].content;
    assert.match(instructions,/"笔记" → open\(text="notes"\)/);
    assert.equal(instructions.includes('open(text="keep")'),false);
    const content=(request.input||request.messages).at(-1).content;
    assert.ok(content[0].text.includes(result.message));
    assert.equal(JSON.stringify(request).includes(privateMarker),false);
    assert.ok(content[0].text.includes('Read the calendar'));
  }
  const old=modelMessages({promptVersion:'v3',visionHistory:0,installedApps:apps},'Old goal',history,'current');
  assert.equal(old[0].content.includes('open(text="notes")'),false);
  assert.equal(old.at(-1).content[0].text.includes(result.message),false);
});
