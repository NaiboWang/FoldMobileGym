import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {includesWorkflowFacts,judgeWorkflow,workflowContract} from '../foldagent_workflow_contract';
const root=path.resolve(import.meta.dirname,'../..');
const read=(p:string)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const rows=read('tasks/unfolded_static/manifest.json').tasks.filter((r:any)=>
  read(r.task).metadata.expansion==='20261104'&&r.family!=='single_app');
describe('new unfolded result contracts',()=>{
  it('rejects numeric substring mistakes while accepting formatting and prose',()=>{
    for(const wrong of ['1899元','8991元','899.5元','0.899元'])
      expect(includesWorkflowFacts(wrong,[['899','899.00']],true)).toBe(false);
    for(const correct of ['售价 899 元','价格：８９９．００元。','899.00 CNY'])
      expect(includesWorkflowFacts(correct,[['899','899.00']],true)).toBe(true);
    expect(includesWorkflowFacts('会议号 836-291-475；60分钟',[['836 291 475','836-291-475'],['60']],true)).toBe(true);
  });
  for(const row of rows)it(`${row.id}: complete/reordered result, missing fact, wrong destination, protected source`,()=>{
    const task=read(row.task),seed=read(row.seed),gold=read(path.posix.join(path.posix.dirname(row.seed),'gold.private.json'));
    const c=workflowContract(task)!;
    const initial={apps:seed.raw_apps},current=structuredClone(initial),t=c.target;
    const value=t.facts!.map(g=>g.at(-1)).reverse().join('， ')+ '。';
    const setText=(s:any,text:string)=>{
      if(t.kind==='wechat')s.apps.wechat.chatDrafts[t.id!]=text;
      else s.apps.notes.notes=[...initial.apps.notes.notes,{id:'new',title:t.title,content:text,updatedAt:1}];
    };
    setText(current,value);
    expect(judgeWorkflow(initial,current,c).passed).toBe(true);
    if(t.kind==='note'){
      const formatted=structuredClone(current);formatted.apps.notes.notes.at(-1).title=' '+t.title!.replace(/\s/g,'')+' ';
      expect(judgeWorkflow(initial,formatted,c).passed).toBe(true);
    }
    expect(judgeWorkflow(initial,initial,c).passed).toBe(false);
    const missing=structuredClone(current);setText(missing,'无相关内容');
    expect(judgeWorkflow(initial,missing,c).passed).toBe(false);
    const wrong=structuredClone(current);
    if(t.kind==='wechat'){wrong.apps.wechat.chatDrafts[t.id!]='';wrong.apps.wechat.chatDrafts['other-chat']=gold.target_text;}
    else wrong.apps.notes.notes.at(-1).title='错误目标笔记';
    expect(judgeWorkflow(initial,wrong,c).passed).toBe(false);
    if(c.protected_paths.length){
      const changed=structuredClone(current),parts=c.protected_paths[0].split('.');
      let node:any=changed;for(const key of parts.slice(0,-1))node=node[key];node[parts.at(-1)!]='changed';
      expect(judgeWorkflow(initial,changed,c).safety_passed).toBe(false);
    }
  });
});
