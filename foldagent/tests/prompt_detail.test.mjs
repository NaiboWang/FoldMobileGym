import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseArgs} from '../run.mjs';
import {modelMessages} from '../prompts.mjs';
import {publicActionResult} from '../public_observation.mjs';
import {ACTION_SCHEMA,FOLD_ACTION_SCHEMA,buildRequest,requestEvidence} from '../api.mjs';
import {validateTaskProfile} from '../task_profiles.mjs';

const installedApps=[{id:'notes',name:'笔记'},{id:'calendar',name:'日历'}];
const base={promptVersion:'v4',visionHistory:1,installedApps};
const options=promptDetail=>({...base,promptDetail});
const png=Buffer.alloc(24);
Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
png.writeUInt32BE(1247,16);png.writeUInt32BE(1350,20);
const screenshot=png.toString('base64');

test('CLI defaults to detailed; tools-only is explicit and requires v4 on every entry',()=>{
  const args=['--task','G04-001','--check'];
  assert.equal(parseArgs(args,{}).promptDetail,'detailed');
  assert.equal(parseArgs([...args,'--prompt-detail','tools-only'],{}).promptDetail,'tools-only');
  for(const promptDetail of ['', 'simple', 'TOOLS-ONLY'])
    assert.throws(()=>parseArgs([...args,'--prompt-detail',promptDetail],{}));
  for(const promptVersion of ['v1','v2','v3']) {
    assert.throws(()=>parseArgs([...args,'--prompt-detail','tools-only','--prompt-version',promptVersion],{}),/requires v4/);
    assert.throws(()=>modelMessages({...options('tools-only'),promptVersion},'task',[],screenshot),/requires v4/);
    assert.doesNotThrow(()=>modelMessages({...options('detailed'),promptVersion},'task',[],screenshot));
  }
  assert.throws(()=>modelMessages(options('unknown'),'task',[],screenshot),/--prompt-detail/);
  assert.deepEqual(modelMessages(base,'task',[],screenshot),modelMessages(options('detailed'),'task',[],screenshot));
});

test('all bundled fixed-unfolded contract fixtures accept either detail setting without relaxing their policy',()=>{
  const root=new URL('../../',import.meta.url);
  const rows=JSON.parse(fs.readFileSync(new URL('tasks/unfolded_static/manifest.json',root))).tasks;
  assert.ok(rows.length>0,'Expected existing fixed-unfolded contract fixtures');
  for(const row of rows) {
    const task=JSON.parse(fs.readFileSync(new URL(row.task,root)));
    for(const promptDetail of ['detailed','tools-only']) {
      const o={...options(promptDetail),runSeed:0,benchmarkProfile:task.metadata.benchmark_profile};
      validateTaskProfile(task,o);
      const messages=modelMessages(o,task.instruction,[],screenshot);
      assert.ok(messages.at(-1).content[0].text.includes(task.instruction));
      assert.match(messages[0].content,/全程保持展开态内屏/);
      assert.match(messages[0].content,/不会注入姿态变化/);
      assert.throws(()=>validateTaskProfile(task,{...o,allowFold:true}),/Fixed-unfolded/);
      if(row.family!=='multi_window') {
        assert.match(messages[0].content,/不得建立双应用分屏/);
        assert.throws(()=>validateTaskProfile(task,{...o,allowSplit:true}),/does not allow split/);
      }
    }
  }
});

test('tools-only removes strategies while preserving every action, safety and window permissions',()=>{
  for(const benchmarkProfile of ['unfolded_static_v1','unfolded_static_multi_window_v1']) {
    const detailed=modelMessages({...options('detailed'),benchmarkProfile},'task',[],screenshot)[0].content;
    const simple=modelMessages({...options('tools-only'),benchmarkProfile},'task',[],screenshot)[0].content;
    assert.ok(simple.length<detailed.length);
    for(const action of ACTION_SCHEMA.properties.action.enum)assert.ok(simple.includes(action));
    assert.match(simple,/有选区时替换选区/);
    assert.match(simple,/JSON Schema/);
    assert.match(simple,/"笔记" → open\(text="notes"\)/);
    assert.match(simple,/不得发送消息、拨号、购买、支付、删除、登录或使用真实位置/);
    assert.doesNotMatch(simple,/页面探索|向上滑动查看|底边中点|先点击|原文末尾|勿重复点击|无需发送、关闭键盘|分隔条调整|↻|优先在/);
    if(benchmarkProfile==='unfolded_static_multi_window_v1') {
      assert.match(simple,/允许左右、上下双应用分屏及全屏/);
      assert.match(simple,/建立、关闭或调整窗格/);
      assert.doesNotMatch(simple,/不得主动调整窗口布局|不得建立双应用分屏/);
    }
  }
});

test('both transports retain the same task, image history, coordinate contract and action schema',()=>{
  const action='{"action":"open","text":"notes"}';
  const history=[{step:1,summary:action,response:action,screenshot,
    public_result:publicActionResult({action:'open'},{valid:true},installedApps),
    passed_after_step:true,benchmark_action:{answer:'PRIVATE_ANSWER'}}];
  for(const api of ['responses','chat-completions'])for(const visionHistory of [0,1]) {
    const requests=['detailed','tools-only'].map(promptDetail=>{
      const messages=modelMessages({...options(promptDetail),visionHistory},'完整的测试目标',history,screenshot);
      const current=messages.at(-1).content;
      assert.ok(current[0].text.includes('完整的测试目标'));
      assert.match(current[0].text,/W=1247、高 H=1350/);
      assert.match(current[0].text,/x=px\/W\*1000/);
      assert.equal(current[1].image_url.url,`data:image/jpeg;base64,${screenshot}`);
      assert.equal(messages.length,visionHistory?4:2);
      const request=buildRequest({api,model:'offline',maxOutputTokens:4096,promptVersion:'v4'},messages);
      const schema=api==='responses'?request.text.format.schema:request.response_format.json_schema.schema;
      assert.deepEqual(schema,ACTION_SCHEMA);
      assert.doesNotMatch(JSON.stringify(request),/PRIVATE_ANSWER|passed_after_step|benchmark_action/);
      return requestEvidence(request);
    });
    assert.deepEqual(requests[0].images,requests[1].images);
  }
});

test('tools-only feedback retains failure codes and facts without corrective instructions',()=>{
  const records=[
    {id:'agent.no_editable_focus',valid:false},
    {id:'agent.invalid_coordinate',valid:false},
    {id:'agent.invalid',valid:false},
    {id:'agent.invalid_native_input',valid:false},
    {id:'agent.native_input_rejected',valid:false},
    {id:'agent.execution_error',valid:false},
    {id:'unknown',valid:false},
    {id:'typed',valid:true},
    {},
  ];
  for(const record of records) {
    const full=publicActionResult({action:'type'},{...record,params:{answer:'PRIVATE_ANSWER'}},installedApps);
    const simple=publicActionResult({action:'type'},{...record,params:{answer:'PRIVATE_ANSWER'}},installedApps,options('tools-only'));
    assert.equal(simple.status,full.status);assert.equal(simple.code,full.code);
    assert.doesNotMatch(simple.message,/请|先点击|确认光标|重新选择|PRIVATE_ANSWER/);
    // Even history collected under the detailed condition must not inject tips.
    const history=[{step:1,summary:'type',public_result:full}];
    const text=modelMessages(options('tools-only'),'task',history,screenshot).at(-1).content[0].text;
    assert.ok(text.includes(simple.message));
    assert.doesNotMatch(text,/先点击输入框|确认光标或选区/);
  }
  const unfocused=publicActionResult({action:'type'},records[0],installedApps,options('tools-only'));
  assert.match(unfocused.message,/当前没有聚焦可编辑的输入框/);
  assert.match(publicActionResult({action:'type'},records[0],installedApps).message,/请先点击输入框/);
  for(const text of ['Keep','notes']) {
    const action={action:'open',text},record={id:'agent.open_app_failed',valid:false};
    const full=publicActionResult(action,record,installedApps);
    const simple=publicActionResult(action,record,installedApps,options('tools-only'));
    assert.equal(simple.code,full.code);assert.doesNotMatch(simple.message,/请使用|请根据|请先/);
  }
});

test('optional fold tools retain their schema and permissions in tools-only mode',()=>{
  const o={...options('tools-only'),allowFold:true,allowSplit:true,currentPosture:'folded'};
  const messages=modelMessages(o,'task',[],screenshot);
  assert.match(messages[0].content,/- fold：折叠到外屏；unfold：展开到内屏/);
  assert.match(messages.at(-1).content[0].text,/当前为折叠态外屏/);
  assert.doesNotMatch(messages[0].content,/内屏通常能展示更多|底边中点/);
  assert.deepEqual(buildRequest({...o,api:'responses',maxOutputTokens:4096},messages).text.format.schema,FOLD_ACTION_SCHEMA);
  assert.throws(()=>modelMessages({...o,benchmarkProfile:'unfolded_static_v1'},'task',[],screenshot),/Fixed-unfolded/);
});
