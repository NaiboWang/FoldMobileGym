import { describe, expect, it } from 'vitest';
import { parseMailSearch, searchMail } from '../apps/Mail/search';
import type { Message, Draft } from '../apps/Mail/types';
const messages: Message[] = [
 {id:'current',from:'Review Team',senderAddress:'review@example.test',subject:'Review round 3',date:'2026-09-18 09:12',body:'Please check samples 184–220. Exact phrase at the tail. OR is text.'},
 {id:'old',from:'Review Team',subject:'Review round 2',date:'2026-09-17 16:20',body:'Completed; do not create another task.'},
 {id:'unicode',from:'全角 ＡＢＣ',subject:'ＨＥＬＬＯ',date:'not provided',body:'Literal [a-z]+ and https://example.test/route'},
];
const drafts: Draft[] = [{id:'current',to:'recipient@example.test',subject:'Local draft',body:'Saved real text',attachments:[{id:'file',path:'/sdcard/Documents/report.pdf',createdAt:1}]}];
const ids=(query:string)=>searchMail(messages,drafts,query).hits.map(hit=>`${hit.kind}:${hit.id}`);
describe('Provided-fact Mail search',()=>{
 it('empty search returns all real identities, keeping message/draft ID namespaces distinct',()=>expect(ids('')).toEqual(['message:current','message:old','message:unicode','draft:current']));
 it('matches subject, body and provided sender text without case or width sensitivity',()=>{expect(ids('hello')).toEqual(['message:unicode']);expect(ids('全角 abc')).toEqual(['message:unicode']);expect(ids('184')).toEqual(['message:current']);});
 it('uses AND, exact phrases, exclusions and explicit OR without discarding tail matches',()=>{expect(ids('review -"round 2"')).toEqual(['message:current']);expect(ids('"exact phrase at the tail"')).toEqual(['message:current']);expect(ids('subject:"round 2" OR in:drafts')).toEqual(['message:old','draft:current']);});
 it('does not turn a quoted OR literal into an expression operator',()=>expect(ids('"OR"')).toEqual(['message:current','draft:current']));
 it('keeps a fully quoted field-looking phrase literal, while allowing quoted field values',()=>{
  expect(parseMailSearch('"is:starred"').groups).toEqual([[{field:'text',value:'is:starred',negative:false}]]);
  expect(parseMailSearch('-"subject:literal"').groups).toEqual([[{field:'text',value:'subject:literal',negative:true}]]);
  expect(parseMailSearch('subject:"literal phrase"').groups).toEqual([[{field:'subject',value:'literal phrase',negative:false}]]);
 });
 it('matches a real sender address only when it is actually provided',()=>{expect(ids('from:review@example.test')).toEqual(['message:current']);expect(ids('-from:missing@example.test')).toEqual(['message:current']);expect(ids('from:"Review Team"')).toEqual(['message:current','message:old']);});
 it('supports local draft recipients and valid attachment references without fabricating message headers',()=>{expect(ids('to:recipient@example.test')).toEqual(['draft:current']);expect(ids('has:attachment filename:report.pdf')).toEqual(['draft:current']);expect(ids('-has:attachment')).toEqual([]);});
 it('filters using only provided calendar days; after includes its day, before excludes it',()=>{expect(ids('after:2026-09-18')).toEqual(['message:current']);expect(ids('before:2026/09/18')).toEqual(['message:old']);expect(ids('-after:2026-09-18')).toEqual(['message:old']);});
 it.each(['before:2025-02-29','after:2026-13-01','after:0000-01-01'])('rejects invalid provided query date %s',query=>expect(searchMail(messages,drafts,query)).toMatchObject({hits:[],error:'date'}));
 it.each(['is:important','label:personal','in:sent','has:drive'])('reports unavailable facts for %s rather than claiming a known empty result',query=>expect(searchMail(messages,drafts,query)).toMatchObject({hits:[],error:'operator'}));
 it('filters supplied local unread relationships and preserves unknown status without the relationship',()=>{
  expect(searchMail(messages,drafts,'is:unread', ['current'], [], ['old']).hits.map(hit=>hit.id)).toEqual(['old']);
  expect(searchMail(messages,drafts,'-is:unread', [], [], ['old']).hits.map(hit=>hit.id)).toEqual(['current','unicode']);
  expect(searchMail(messages,drafts,'is:unread').error).toBe('operator');
 });
 it('filters real message-star relationships without confusing equal draft IDs',()=>{
  expect(searchMail(messages,drafts,'is:starred',['current','missing']).hits.map(hit=>`${hit.kind}:${hit.id}`)).toEqual(['message:current']);
  expect(searchMail(messages,drafts,'-is:starred',['current']).hits.map(hit=>`${hit.kind}:${hit.id}`)).toEqual(['message:old','message:unicode']);
  expect(searchMail(messages,drafts,'is:starred').hits).toEqual([]);
 });
 it('combines stars with text, negation and OR while preserving source identities',()=>{
  const starred=['current','old'];
  expect(searchMail(messages,drafts,'IS:STARRED subject:"round 2"',starred).hits.map(hit=>hit.id)).toEqual(['old']);
  expect(searchMail(messages,drafts,'is:starred -subject:"round 2"',starred).hits.map(hit=>hit.id)).toEqual(['current']);
  expect(searchMail(messages,drafts,'is:starred OR in:drafts',['old']).hits.map(hit=>`${hit.kind}:${hit.id}`)).toEqual(['message:old','draft:current']);
 });
 it.each(['"unclosed','OR test','test OR','subject:','""'])('does not silently broaden malformed expression %s',query=>expect(searchMail(messages,drafts,query).error).toBeDefined());
 it('treats punctuation/URLs as literal data, never regex or unknown commands',()=>{expect(ids('[a-z]+')).toEqual(['message:unicode']);expect(ids('https://example.test/route')).toEqual(['message:unicode']);expect(ids('subject:.*')).toEqual([]);});
 it('resolves duplicate IDs by the same first source as the actual open action',()=>{const duplicate={...messages[0],subject:'Shadow-only term'};expect(searchMail([...messages,duplicate],drafts,'shadow-only').hits).toEqual([]);});
 it('searches beyond the first rendered/windowed rows without altering source data',()=>{const corpus=Array.from({length:1000},(_,index)=>({...messages[0],id:`row-${index}`,body:`Item ${index}`}));corpus.push({...messages[0],id:'tail',body:'Needle in the actual last entity'});const before=JSON.stringify(corpus);expect(searchMail(corpus,[],'needle').hits.map(hit=>hit.id)).toEqual(['tail']);expect(JSON.stringify(corpus)).toBe(before);});
});
