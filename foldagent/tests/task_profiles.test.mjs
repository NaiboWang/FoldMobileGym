import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isUnfoldedStatic,validateTaskProfile,UNFOLDED_MULTI_WINDOW} from '../task_profiles.mjs';
import {modelMessages} from '../prompts.mjs';
const fixtures=new URL('../../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,fixtures)));
const task=read('tasks/unfolded_static/single_app/SA01/instances/base/static.task.json');
test('fixed-unfolded profile rejects split, legacy prompts and dynamic windows',()=>{
  validateTaskProfile(task,{promptVersion:'v4'});
  assert.equal(isUnfoldedStatic(task),true);
  assert.throws(()=>validateTaskProfile(task,{allowSplit:true}),/does not allow split/);
  assert.throws(()=>validateTaskProfile(task,{promptVersion:'v1'}),/requires v4/);
  const changed=structuredClone(task);changed.initial_window.posture='folded';
  assert.throws(()=>validateTaskProfile(changed),/Invalid/);
  assert.doesNotThrow(()=>validateTaskProfile({metadata:{}},{allowSplit:true}));
});
test('fixed-unfolded multi-window preserves create-split and preconfigured split contracts',()=>{
  const rows=read('tasks/unfolded_static/manifest.json').tasks.filter(row=>row.family==='multi_window');
  assert.ok(rows.length>0,'Expected existing multi-window contract fixtures');
  for(const row of rows) {
    const split=read(row.task);
    validateTaskProfile(split,{promptVersion:'v4'});
    validateTaskProfile(split,{promptVersion:'v4',allowSplit:true});
    assert.throws(()=>validateTaskProfile(split,{promptVersion:'v3'}),/requires v4/);
    const changed=structuredClone(split);changed.initial_window.mode=changed.initial_window.mode==='split'?'fullscreen':'split';
    assert.throws(()=>validateTaskProfile(changed),/Invalid/);
    changed.initial_window=structuredClone(split.initial_window);changed.evaluator.require_post_transition_action=true;
    assert.throws(()=>validateTaskProfile(changed),/Invalid/);
  }
});
test('multi-window prompt enables visible split operations automatically without fold guidance',()=>{
  const messages=modelMessages({promptVersion:'v4',benchmarkProfile:UNFOLDED_MULTI_WINDOW,
    installedApps:[{id:'weather',name:'天气'},{id:'calendar',name:'日历'}]},'建立上下分屏并填写日程',[],'');
  const system=messages[0].content;
  assert.match(system,/全程保持展开态内屏/);
  assert.match(system,/允许通过可见手势操作分屏/);
  assert.match(system,/切换分屏方向/);
  assert.match(system,/无需保持或恢复初始比例/);
  assert.match(system,/只保留目标应用全屏/);
  assert.doesNotMatch(system,/姿态由环境控制|折叠后系统自动|不得主动调整窗口布局|不得建立双应用分屏/);
  assert.ok(messages.at(-1).content[0].text.includes('建立上下分屏并填写日程'));
  assert.throws(()=>modelMessages({promptVersion:'v1',benchmarkProfile:UNFOLDED_MULTI_WINDOW},'task',[],''),/requires v4/);
});
test('new prompt is explicit, retains the complete goal and exposes no private answer',()=>{
  const messages=modelMessages({promptVersion:'v4',benchmarkProfile:'unfolded_static_v1',installedApps:[{id:'notes',name:'笔记'}],visionHistory:6},task.instruction,[],'');
  const system=messages[0].content;
  assert.match(system,/全程保持展开态内屏/);
  assert.match(system,/不会注入姿态变化/);
  assert.match(system,/按顺序使用 open/);
  assert.doesNotMatch(system,/姿态由环境控制|折叠后系统自动/);
  assert.ok(messages.at(-1).content[0].text.includes(task.instruction));
  assert.doesNotMatch(JSON.stringify(messages), /single_app_v3|seed_contract|target_id|gold\.private/);
  const old=modelMessages({promptVersion:'v4',installedApps:[{id:'notes',name:'笔记'}]},'task',[],'')[0].content;
  assert.match(old,/姿态由环境控制/);
});
