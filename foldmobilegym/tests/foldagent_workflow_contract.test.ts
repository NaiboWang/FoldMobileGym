import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {judgeWorkflow,workflowContract,workflowWindowMatches} from '../foldagent_workflow_contract';
const root=path.resolve(import.meta.dirname,'../..');
const read=(file:string)=>JSON.parse(fs.readFileSync(path.resolve(root,file),'utf8'));
const rows=read('tasks/unfolded_static/manifest.json').tasks.filter((r:any)=>
  r.condition==='static'&&r.orientation!=='stacked'&&/^(CA|MW)0[1-6]$/.test(r.card));
const clone=<T,>(x:T):T=>structuredClone(x);
function solution(row:any){
  const task=read(row.task),seed=read(row.seed),gold=read(path.join(path.dirname(row.seed),'gold.private.json'));
  const initial={apps:seed.raw_apps,os:seed.os},current=clone(initial), c=workflowContract(task)!;
  const t=c.target,app=current.apps[t.app];
  if(t.kind==='wechat')app.chatDrafts[t.id!]=gold.target_text;
  if(t.kind==='note')app.notes.push({id:'new-note',title:t.title,content:gold.target_text,folderId:'unfiled',updatedAt:123});
  if(t.kind==='checklist')app.notes.find((n:any)=>n.id===t.id).checklist=gold.target_text.map((text:string,i:number)=>({id:`row${i}`,text,completed:false}));
  if(t.kind==='calendar')app.events.find((e:any)=>e.id===t.id).description=gold.target_text;
  if(t.kind==='sms')app.composeDrafts['["",""]']={recipient:t.phone,body:gold.target_text,boundPhone:null};
  return {initial,current,c};
}
describe('CA01–CA06 / MW01–MW06 semantic judging with current static fixtures',()=>{
 it('covers all migrated cards and their two content instances',()=>{
  expect([...new Set(rows.map((r:any)=>r.card))].sort()).toEqual([
   'CA01','CA02','CA03','CA04','CA05','CA06','MW01','MW02','MW03','MW04','MW05','MW06',
  ]);
  for(const card of new Set(rows.map((r:any)=>r.card))){
   const instances=rows.filter((r:any)=>r.card===card).map((r:any)=>r.instance);
   expect(instances).toHaveLength(2);
   expect(new Set(instances).size).toBe(2);
   expect(instances).toContain('base');
  }
 });
 it('permits browsing history additions but rejects deleting initial history',()=>{
  for(const card of ['CA03','MW03']){
   const {initial,current,c}=solution(rows.find((r:any)=>r.card===card));
   initial.apps.browser.visitedUrls=['benchmark://old-notice'];
   current.apps.browser.visitedUrls=['benchmark://old-notice','benchmark://notice'];
   expect(judgeWorkflow(initial,current,c).passed).toBe(true);
   current.apps.browser.visitedUrls=['benchmark://notice'];
   expect(judgeWorkflow(initial,current,c).safety_passed).toBe(false);
  }
 });
 it('checks effective split direction, ordered apps, and foreground visibility',()=>{
  const {c}=solution(rows.find((r:any)=>r.card==='MW05'));
  const state={os:{tasks:[{taskId:'a',rootAppId:c.source.app},{taskId:'b',rootAppId:c.target.app}],isLauncherVisible:false},
   foldable:{posture:'unfolded',multi_window:{mode:'split',primary_task_id:'a',secondary_task_id:'b',split_orientation:undefined as string|undefined}}};
  expect(workflowWindowMatches(c,state)).toBe(true);
  state.foldable.posture='folded';expect(workflowWindowMatches(c,state)).toBe(true);
  state.foldable.multi_window.split_orientation='side_by_side';expect(workflowWindowMatches(c,state)).toBe(false);
  state.foldable.multi_window.split_orientation='stacked';expect(workflowWindowMatches(c,state)).toBe(true);
  state.os.isLauncherVisible=true;expect(workflowWindowMatches(c,state)).toBe(false);
  state.os.isLauncherVisible=false;state.os.tasks[1].rootAppId='other';expect(workflowWindowMatches(c,state)).toBe(false);
 });
 for(const row of rows){
  it(`${row.card}/${row.instance} accepts complete business outcome and rejects untouched fixture`,()=>{
   const {initial,current,c}=solution(row);expect(judgeWorkflow(initial,current,c).passed).toBe(true);
   expect(judgeWorkflow(initial,initial,c).passed).toBe(false);
  });
  it(`${row.card}/${row.instance} rejects missing/wrong fact and unintended writes`,()=>{
   const {initial,current,c}=solution(row),t=c.target,a=current.apps[t.app];
   if(t.kind==='wechat')a.chatDrafts[t.id!]='错误内容';
   if(t.kind==='note')a.notes.at(-1).content='错误内容';
   if(t.kind==='checklist')a.notes.find((n:any)=>n.id===t.id).checklist.pop();
   if(t.kind==='calendar')a.events.find((n:any)=>n.id===t.id).description=t.exact?.includes('轻装出行')?'带外套':'轻装出行';
   if(t.kind==='sms')a.composeDrafts['["",""]'].recipient='13999999999';
   expect(judgeWorkflow(initial,current,c).passed).toBe(false);
   const good=solution(row);
   const parts=c.protected_paths[0].split('.');let parent:any=good.current;for(const key of parts.slice(0,-1))parent=parent[key];parent[parts.at(-1)!]=null;
   expect(judgeWorkflow(good.initial,good.current,c).passed).toBe(false);
  });
 }
 it('rejects duplicate notes and completing a checklist item',()=>{
  for(const kind of ['note','checklist']){
   const row=rows.find((r:any)=>workflowContract(read(r.task))!.target.kind===kind);
   const {initial,current,c}=solution(row);
   if(kind==='note')current.apps.notes.notes.push({...current.apps.notes.notes.at(-1),id:'duplicate'});
   else current.apps.notes.notes.find((n:any)=>n.id===c.target.id).checklist[0].completed=true;
   expect(judgeWorkflow(initial,current,c).passed).toBe(false);
  }
 });
 it('permits the calendar adapter derived note alias but protects event identity fields',()=>{
  const row=rows.find((r:any)=>r.card==='CA05'),{initial,current,c}=solution(row);
  const before=initial.apps.calendar.events.find((e:any)=>e.id===c.target.id);
  const after=current.apps.calendar.events.find((e:any)=>e.id===c.target.id);
  before.note=before.description;after.note=after.description;
  expect(judgeWorkflow(initial,current,c).passed).toBe(true);
  after.location='Unintended location';
  expect(judgeWorkflow(initial,current,c).passed).toBe(false);
 });
 it('normalizing formatting does not excuse missing facts or wrong identity',()=>{
  const row=rows.find((r:any)=>r.card==='CA01'), {initial,current,c}=solution(row);
  current.apps.wechat.chatDrafts['target-chat']=current.apps.wechat.chatDrafts['target-chat'].slice(3);
  expect(judgeWorkflow(initial,current,c).passed).toBe(false);
  const good=solution(row);good.current.apps.wechat.chatDrafts['other-chat']='写错人';
  expect(judgeWorkflow(good.initial,good.current,c).passed).toBe(false);
 });
});
