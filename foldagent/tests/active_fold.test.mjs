import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ACTION_SCHEMA,FOLD_ACTION_SCHEMA,buildRequest,callModel,validateAction} from '../api.mjs';
import {parseArgs} from '../run.mjs';
import {modelMessages} from '../prompts.mjs';
import {validateTaskProfile} from '../task_profiles.mjs';
import {readPublicPosture,publicActionResult} from '../public_observation.mjs';
import {executeAction} from '../../foldagent_runtime/browser_executor.mjs';

const task=JSON.parse(fs.readFileSync(new URL('../examples/calculator.task.json',import.meta.url)));
const full=action=>({action,coordinate:null,coordinate2:null,text:null,button:null,time:null,status:null});
const messages=[{role:'system',content:'Operate the phone.'},{role:'user',content:'Task'}];

test('fold schema and parsing are opt-in on both API transports',async()=>{
  for(const api of ['responses','chat-completions']) {
    const options={api,model:'local',baseUrl:'http://localhost/v1',apiKey:'test',apiTimeoutMs:1000,maxOutputTokens:1000,retries:0};
    const schema=request=>api==='responses'?request.text.format.schema:request.response_format.json_schema.schema;
    assert.deepEqual(schema(buildRequest(options,messages)),ACTION_SCHEMA);
    assert.deepEqual(schema(buildRequest({...options,allowFold:true},messages)),FOLD_ACTION_SCHEMA);
    const response=api==='responses'
      ?{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(full('unfold'))}]}]}
      :{choices:[{finish_reason:'stop',message:{content:JSON.stringify(full('unfold'))}}]};
    const fetchImpl=async()=>new Response(JSON.stringify(response));
    assert.equal((await callModel(options,messages,{fetchImpl})).action,undefined);
    assert.equal((await callModel({...options,allowFold:true},messages,{fetchImpl})).action.action,'unfold');
  }
  for(const action of ['fold','unfold']) {
    assert.throws(()=>validateAction(full(action)),/forbidden/);
    assert.deepEqual(validateAction(full(action),{allowFold:true}),full(action));
    assert.throws(()=>validateAction({...full(action),text:'hidden'},{allowFold:true}),/no parameters/);
  }
  assert.throws(()=>validateAction(full('set_posture'),{allowFold:true}),/forbidden/);
});

test('active-fold CLI and profiles retain the fixed-unfolded experiment contract',()=>{
  assert.equal(parseArgs(['--task-file','foldagent/examples/calculator.task.json','--seed-file','foldagent/examples/calculator.seed.json','--allow-fold','--check']).allowFold,true);
  assert.throws(()=>parseArgs(['--task','J99-001','--allow-fold','--prompt-version','v3']),/requires v4/);
  validateTaskProfile(task,{allowFold:true,promptVersion:'v4'});
  for(const benchmark_profile of ['unfolded_static_v1','unfolded_static_multi_window_v1'])
    assert.throws(()=>validateTaskProfile({...task,metadata:{benchmark_profile}},{allowFold:true}),/Fixed-unfolded/);
  for(const change of [{event_plan:[{}]},{recovery:{}},{evaluator:{must_have_events:['event']}},{evaluator:{require_post_transition_action:true}}])
    assert.throws(()=>validateTaskProfile({...task,...change},{allowFold:true}),/cannot be mixed/);
  assert.throws(()=>validateTaskProfile({...task,initial_window:{posture:'half_folded'}},{allowFold:true}),/initial posture/);
});

test('current observations repeat the goal, posture tools and coordinate rules',()=>{
  for(const currentPosture of ['folded','unfolded']) {
    const options={allowFold:true,allowSplit:true,promptVersion:'v4',currentPosture,installedApps:[{id:'calculator',name:'计算器'}]};
    const result=modelMessages(options,'Compute 12+7',[],'');
    assert.match(result[0].content,/fold 折叠到外屏、unfold 展开到内屏/);
    assert.match(result[0].content,/展开后恢复先前的展开态方向/);
    assert.doesNotMatch(result[0].content,/姿态由环境控制|不要主动折叠来切换方向|或主动折叠\/展开/);
    const observation=result.at(-1).content[0].text;
    assert.ok(observation.includes('Compute 12+7'));
    assert.match(observation,/本轮允许 fold/);
    assert.ok(observation.includes(currentPosture==='folded'?'当前为折叠态外屏':'当前为展开态内屏'));
    assert.match(observation,/1000/);
  }
  assert.throws(()=>modelMessages({allowFold:true,promptVersion:'v3'},'task',[],''),/requires v4/);
  assert.throws(()=>modelMessages({allowFold:true,benchmarkProfile:'unfolded_static_v1'},'task',[],''),/Fixed-unfolded/);
});

test('executor uses controller policy and has no raw setPosture fallback',async()=>{
  const fail={eval:()=>{throw Error('must not contact browser');}};
  assert.equal((await executeAction(fail,full('fold'))).valid,false);
  assert.equal((await executeAction(fail,full('set_posture'),{allowFold:true})).valid,false);
  const calls=[];
  const controller={performAgentPostureAction:async action=>{calls.push(action);return {id:action,kind:'device',valid:true};}};
  const cdp={eval:expression=>vm.runInNewContext(expression,{window:{__FOLDAGENT_BENCH__:controller}})};
  assert.equal((await executeAction(cdp,full('unfold'),{allowFold:true})).valid,true);
  assert.deepEqual(calls,['unfold']);
  const old={eval:expression=>vm.runInNewContext(expression,{window:{}})};
  assert.equal((await executeAction(old,full('fold'),{allowFold:true})).id,'agent.posture_unavailable');
});

test('public posture and feedback expose no private device/app data',async()=>{
  const state={posture:'folded'};
  Object.defineProperty(state,'apps',{get(){throw Error('private app state');}});
  assert.equal(await readPublicPosture({eval:expression=>vm.runInNewContext(expression,{window:{__FOLDAGENT__:{getState:()=>state}}})}),'folded');
  await assert.rejects(readPublicPosture({eval:async()=>null}),/unavailable/);
  for(const action of ['fold','unfold']) {
    const feedback=publicActionResult(full(action),{id:action,kind:'device',valid:true,params:{answer:'SECRET'}},[]);
    assert.equal(feedback.code,action==='fold'?'folded':'unfolded');
    assert.equal(JSON.stringify(feedback).includes('SECRET'),false);
    assert.deepEqual(Object.keys(feedback).sort(),['code','message','status']);
    assert.equal(publicActionResult(full(action),{id:action,valid:false},[]).code,'posture_not_allowed');
  }
});
