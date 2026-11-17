import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import * as TimeService from '../os/TimeService';
import {ownOutgoingMessageIds} from '../apps/Wechat/utils/chatMessageIdentity';
import type {ChatSession,Message} from '../apps/Wechat/types';
vi.mock('../os/AIService',()=>({}));
import {useWechatStore} from '../apps/Wechat/state';
const initial=useWechatStore.getState();
const target=initial.contacts.find(contact=>!contact.aiConfig?.enabled)!;
const text=(id:string):Message=>({id,type:'text',content:id,senderId:initial.user.wxid,timestamp:1000});
describe('WeChat actual-store message identity and success ownership',()=>{
 afterEach(()=>{vi.restoreAllMocks();useWechatStore.setState(initial,true);});
 beforeEach(()=>{vi.spyOn(TimeService,'now').mockReturnValue(1789176600000);useWechatStore.setState({...initial,chats:[],chatDrafts:{[target.wxid]:'Original draft'},sendCount:0});});
 it('preserves old messages and allocates IDs against every chat plus this outgoing batch',()=>{
  const old=[{id:'a',user:{wxid:'a',name:'A',avatar:''},messages:[text('1000'),text('1000_1')]}] as ChatSession[];
  const input=[text('1000'),text('1000'),text('free')],snapshot=structuredClone(old),out=ownOutgoingMessageIds(old,input);
  expect(out.map(value=>value.id)).toEqual(['1000_2','1000_3','free']);expect(old).toEqual(snapshot);expect(input[0].id).toBe('1000');
 });
 it('legitimate frozen-time sends create distinct entities without changing the original draft/time semantics',()=>{
  useWechatStore.getState().sendMessage(target.wxid,'First');useWechatStore.getState().updateChatDraft(target.wxid,'Second');useWechatStore.getState().sendMessage(target.wxid,'Second');
  const state=useWechatStore.getState(),messages=state.chats.find(chat=>chat.id===target.wxid)!.messages;
  expect(new Set(messages.map(message=>message.id)).size).toBe(messages.length);expect(state.sendCount).toBe(2);expect(state.chatDrafts[target.wxid]).toBe('');
  const sent=messages.filter(message=>message.type==='text');expect(sent.map(message=>message.content)).toEqual(['First','Second']);expect(sent[0].timestamp).toBe(sent[1].timestamp);
 });
 it('unknown recipients and blank content do not fake a send count or clear the real recipient draft',()=>{
  const before=useWechatStore.getState();useWechatStore.getState().sendMessage('not-a-real-peer','Rejected');useWechatStore.getState().sendMessage(target.wxid,'  ');
  expect(useWechatStore.getState()).toBe(before);
 });
 it('image/file/pat/timeline message allocation uses the same noncolliding real corpus',()=>{
  const store=()=>useWechatStore.getState();store().sendImages(target.wxid,['/sdcard/a.jpg']);store().sendImages(target.wxid,['/sdcard/b.jpg']);
  store().sendFiles(target.wxid,[{path:'/sdcard/a.txt',name:'a.txt',size:1}]);store().sendFiles(target.wxid,[{path:'/sdcard/b.txt',name:'b.txt',size:1}]);store().sendPat(target.wxid);store().sendPat(target.wxid);
  const messages=store().chats.find(chat=>chat.id===target.wxid)!.messages;expect(new Set(messages.map(message=>message.id)).size).toBe(messages.length);expect(store().sendCount).toBe(0);expect(store().chatDrafts[target.wxid]).toBe('Original draft');
 });
});
