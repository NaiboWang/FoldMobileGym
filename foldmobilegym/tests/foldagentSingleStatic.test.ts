import {describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
vi.mock('../os/FileSystemService',()=>({initFileSystem:vi.fn(),getNode:vi.fn(),getFileContentToken:vi.fn(),readFile:vi.fn(),writeFile:vi.fn(),snapshotFileSystem:vi.fn()}));
import {staticSingleContract,validateStaticSingle,judgeStaticSingle,prepareSingleFiles,refreshSingleFiles,singleFileSnapshot} from '../foldagent_single_app_static';
import {singleAppContract,validateSingleAppInitial,judgeSingleApp,observeSingleApp} from '../foldagent_single_app_contract';
import {initFileSystem,getNode,getFileContentToken,readFile,writeFile,snapshotFileSystem} from '../os/FileSystemService';
const root=path.resolve(import.meta.dirname,'../..');
const read=(f:string)=>JSON.parse(fs.readFileSync(path.resolve(root,f),'utf8'));
const allRows=read('tasks/unfolded_static/single_app/manifest.json').tasks;
// This suite exercises the explicit v3 contract, not generic result_rules_v1 tasks.
// Every other manifest row is covered by unfoldedSingleResults.test.ts.
const rows=allRows.filter((row:any)=>read(row.task).seed_contract?.single_app_v3!==undefined);
function example(row:any){
  const task=read(row.task),seed=read(row.seed),c=staticSingleContract(task)!;
  const initial:any={apps:structuredClone(seed.raw_apps),os:structuredClone(seed.os),runtime:{active_app_id:c.app,app_routes:{[c.app]:'/'}}};
  initial.os.providers??={};initial.os.providers.contacts??={contacts:[]};
  if(c.card==='SA12')initial.os.settings={global:{darkModeEnabled:!c.value,rotationLocked:false},system:{brightness:37}};
  if(c.card==='SA03')initial.apps.mail.draft_input=initial.apps.mail.draftInput;
  if(seed.single_app_files){
    initial.single_files={nodes:[],bytes:{}};
    for(const [i,f]of seed.single_app_files.entries()){
      const bytes=f.base64?Buffer.from(f.base64,'base64'):Buffer.from(f.text);
      initial.single_files.nodes.push({id:'file'+i,path:f.path,size:bytes.length,mimeType:f.mime});
      initial.single_files.bytes[f.path]={hash:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
    }
  }
  validateStaticSingle(initial,c);
  const current=structuredClone(initial),a=current.apps[c.app],id=c.target_id,d=c.details;
  switch(c.card){
    case 'SA01':a.notes.find((n:any)=>n.id===id).content=c.value;current.runtime.app_routes.notes='/note/'+id;break;
    case 'SA02':a.chatDrafts[id]=c.value;current.runtime.app_routes.wechat='/chat/'+id;break;
    case 'SA03':a.drafts.find((x:any)=>x.id===d.draft_id).body=c.value;break;
    case 'SA04':a.events.find((x:any)=>x.id===id).location=c.value;break;
    case 'SA06':a.bookmarks[id]={id,url:id,title:d.title};a.tabs[0].url=id;break;
    case 'SA07':a.savedPlaceIds=[id];break;
    case 'SA08':current.apps.answer_sheet.answers={'0':String(c.value[0]),'1':String(c.value[1])};current.apps.answer_sheet.submitted=true;current.runtime.active_app_id='answer_sheet';break;
    case 'SA09':current.os.providers.contacts.contacts.find((x:any)=>x.id===id).notes=c.value;break;
    case 'SA10':a.conversationDrafts[id].body=c.value;current.runtime.app_routes.sms='/conversation/'+id;break;
    case 'SA11':a.alarms.push({id:'new',note:c.value,hour:d.hour,minute:d.minute,repeat:'once',enabled:true});break;
    case 'SA12':current.os.settings.global.darkModeEnabled=c.value;break;
    case 'SA13':current.os.providers.media.favorites.push(id);break;
    case 'SA14':current.single_files.nodes.push({...initial.single_files.nodes[0],id:'copy',path:c.value});current.single_files.bytes[c.value]=structuredClone(initial.single_files.bytes[id]);break;
  }
  return {task,initial,current,c};
}
describe('single-app Static v3 admission and grading',()=>{
  it('dispatches all v3 cards without applying historical append contracts or transition anchors',()=>{
    for(const row of rows){
      const {task,initial,current,c}=example(row);
      const selected=singleAppContract(task)!;
      expect(selected).toEqual(c);
      expect(()=>validateSingleAppInitial(initial,selected)).not.toThrow();
      expect(judgeSingleApp(initial,initial,selected).passed).toBe(false);
      expect(judgeSingleApp(initial,current,selected).passed).toBe(true);
      expect(observeSingleApp(selected,current,initial)).toEqual({candidate:false,editor:false});
    }
  });
  it('awaits filesystem initialization before seeding media fixtures',async()=>{
    const calls:string[]=[];
    vi.mocked(initFileSystem).mockImplementation(async()=>{await Promise.resolve();calls.push('ready');});
    vi.mocked(writeFile).mockImplementation(async()=>{expect(calls[0]).toBe('ready');calls.push('write');return {} as any;});
    vi.mocked(snapshotFileSystem).mockReturnValue({nodes:[]});
    const c=example(rows.find((r:any)=>r.card==='SA13')).c;
    await prepareSingleFiles({single_app_files:[1,2].map(i=>({path:'/sdcard/FoldAgentSingle/'+i,text:'data',mime:'text/plain'}))},c);
    expect(calls).toEqual(['ready','write','write']);
  });
  it('invalidates bytes on same-ID metadata reconstruction and on same-size content writes',async()=>{
    const c=example(rows.find((r:any)=>r.card==='SA13')).c;
    let node:any={id:'byte-test',path:'/sdcard/FoldAgentSingle/byte-test.txt',type:'file'},token=0,content='old';
    vi.mocked(getNode).mockImplementation(()=>node);
    vi.mocked(getFileContentToken).mockImplementation(()=>token);
    vi.mocked(snapshotFileSystem).mockImplementation(()=>({nodes:[node]}));
    vi.mocked(readFile).mockImplementation(async()=>new Blob([content]));
    await refreshSingleFiles(c);
    const old=singleFileSnapshot(c).bytes[node.path];
    node={...node};content='new'; // Reloaded metadata has a fresh object and zero token.
    expect(singleFileSnapshot(c).bytes[node.path]).toBe(null);
    await refreshSingleFiles(c);
    expect(singleFileSnapshot(c).bytes[node.path].hash).not.toBe(old.hash);
    token=1;content='alt';
    expect(singleFileSnapshot(c).bytes[node.path]).toBe(null);
    await refreshSingleFiles(c);
    expect(singleFileSnapshot(c).bytes[node.path].hash).toBe(createHash('sha256').update('alt').digest('hex'));
  });
  for(const row of rows){
    it(row.id+' no-op fails, intended solution passes, wrong target fails',()=>{
      const {initial,current,c}=example(row);
      expect(judgeStaticSingle(initial,initial,c).passed).toBe(false);
      expect(judgeStaticSingle(initial,current,c).passed).toBe(true);
      const wrong=structuredClone(current),a=wrong.apps[c.app];
      switch(c.card){
        case 'SA01':a.notes.find((x:any)=>x.id===c.target_id).content='';a.notes[0].content=c.value;break;
        case 'SA02':a.chatDrafts[c.target_id]='';a.chatDrafts['other-chat']=c.value;break;
        case 'SA03':a.drafts[0].replyTo.messageId='old';break;
        case 'SA04':a.events.find((x:any)=>x.id===c.target_id).startTs+=60000;break;
        case 'SA06':a.bookmarks[c.target_id].url='benchmark://old-notice';break;
        case 'SA07':a.savedPlaceIds=['other-place'];break;
        case 'SA08':wrong.apps.answer_sheet.answers={'0':String(c.value[1]),'1':String(c.value[0])};break;
        case 'SA09':wrong.os.providers.contacts.contacts[0].phones[0].number='0';break;
        case 'SA10':a.conversationDrafts[c.target_id].recipient='0';break;
        case 'SA11':a.alarms.push({...a.alarms.at(-1),id:'duplicate'});break;
        case 'SA12':wrong.os.settings.system.brightness=90;break;
        case 'SA13':wrong.single_files.bytes[c.target_id].hash='changed';break;
        case 'SA14':wrong.single_files.bytes[c.value]={...wrong.single_files.bytes[c.value],hash:'same-size-wrong-bytes'};break;
      }
      expect(judgeStaticSingle(initial,wrong,c).passed).toBe(false);
    });
  }
  it('does not accept an unsubmitted query result or an unsaved mail editor',()=>{
    const weather=example(rows.find((r:any)=>r.card==='SA08'));
    weather.current.apps.answer_sheet.submitted=false;
    expect(judgeStaticSingle(weather.initial,weather.current,weather.c).passed).toBe(false);
    const mail=example(rows.find((r:any)=>r.card==='SA03'));
    mail.current.apps.mail.drafts[0].body='';mail.current.apps.mail.editorBuffers.reply={body:mail.c.value};
    expect(judgeStaticSingle(mail.initial,mail.current,mail.c).passed).toBe(false);
  });
  it('allows optional terminal punctuation but rejects repeated payloads and prefixes',()=>{
    for(const row of rows.filter((r:any)=>['SA01','SA02','SA03','SA04','SA09','SA10'].includes(r.card))){
      const {initial,current,c}=example(row),a=current.apps[c.app];
      const target:any=c.card==='SA01'?a.notes.find((x:any)=>x.id===c.target_id):c.card==='SA03'?a.drafts[0]:c.card==='SA04'?a.events.find((x:any)=>x.id===c.target_id):c.card==='SA09'?current.os.providers.contacts.contacts[0]:c.card==='SA10'?a.conversationDrafts[c.target_id]:a.chatDrafts;
      const key=({SA01:'content',SA02:c.target_id,SA03:'body',SA04:'location',SA09:'notes',SA10:'body'} as any)[c.card];
      target[key]=c.value+'。\n';expect(judgeStaticSingle(initial,current,c).passed).toBe(true);
      target[key]=c.value+c.value;expect(judgeStaticSingle(initial,current,c).passed).toBe(false);
      target[key]='您好，'+c.value;expect(judgeStaticSingle(initial,current,c).passed).toBe(false);
    }
  });
  it('rejects invalid task/app bindings and missing initial objects',()=>{
    for(const row of rows){
      const {task,initial,c}=example(row);
      task.apps=['notes','wechat'];expect(()=>staticSingleContract(task)).toThrow();
      delete initial.apps[c.app];expect(()=>validateStaticSingle(initial,c)).toThrow();
    }
  });
});
