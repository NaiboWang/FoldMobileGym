import { describe, expect, it } from 'vitest';
import { buildXEntityIndex, findXQuotes, findXReposterIds, findXReplyTree } from '../apps/X/utils/entityIndex';
import { withRelationshipDerivedStats } from '../apps/X/utils/hydrate';
import type { XPost } from '../apps/X/types';
const post=(id:string,extra:Partial<XPost>={}):XPost=>({id,authorId:'Author',content:id,time:'just now',stats:{comments:0,retweets:0,likes:0,views:0},...extra});
describe('X full entity truth index',()=>{
 it('finds actual quotes beyond the first 200 feed rows without inventing fallback rows',()=>{
  const rows=Array.from({length:240},(_,i)=>post('p_'+i));rows.push(post('quote',{quotedPostId:'p_0'}));
  const index=buildXEntityIndex(rows,{},{});expect(findXQuotes(index,'p_0').map(p=>p.id)).toEqual(['quote']);expect(findXQuotes(index,'unknown')).toEqual([]);
 });
 it('preserves exact source identity and case without modifying base or runtime entities',()=>{
  const base=[post('p_A')],runtime={quote:post('quote',{quotedPostId:'p_A'})},before=JSON.stringify({base,runtime});const index=buildXEntityIndex(base,{},runtime);
  expect(index.posts.get('quote')).toBe(runtime.quote);expect(findXQuotes(index,'p_a')).toEqual([]);expect(JSON.stringify({base,runtime})).toBe(before);
 });
 it('applies complete overrides and tombstones to base posts and imported replies',()=>{
  const original=post('r_p_1_0',{content:'old'}),replacement=post(original.id,{content:'replacement'}),base=[post('p_1')],replies={p_1:[original]};
  expect(buildXEntityIndex(base,replies,{[original.id]:replacement}).posts.get(original.id)).toBe(replacement);
  const hidden=buildXEntityIndex(base,replies,{p_1:null,[original.id]:null});expect(hidden.posts.has('p_1')).toBe(false);expect(findXReplyTree(hidden,'p_1')).toEqual([]);
 });
 it('retains structural reply parent identity but respects an explicit full-overlay move',()=>{
  const reply=post('r_p_1_0'),replacement=post(reply.id,{threadId:'p_2'});
  const index=buildXEntityIndex([post('p_1'),post('p_2')],{p_1:[reply]},{[reply.id]:replacement});
  expect(findXReplyTree(index,'p_1')).toEqual([]);expect(findXReplyTree(index,'p_2').map(p=>p.id)).toEqual([reply.id]);
 });
 it('merges arbitrary-ID nested, imported and runtime replies exactly once',()=>{
  const a=post('A',{replies:[post('B')]}),c=post('C',{threadId:'root'}),index=buildXEntityIndex([post('root',{replies:[a]})],{root:[a]},{C:c});
  expect(findXReplyTree(index,'root').map(p=>p.id)).toEqual(['A','C']);expect(findXReplyTree(index,'root')[0].replies?.map(p=>p.id)).toEqual(['B']);expect(index.posts.size).toBe(4);
 });
 it('does not resurrect children omitted from a complete inline-parent replacement',()=>{
  const original=post('root',{replies:[post('old_child')]}),index=buildXEntityIndex([original],{},{root:post('root',{content:'full replacement'})});
  expect(index.posts.has('old_child')).toBe(false);expect(findXReplyTree(index,'root')).toEqual([]);
 });
 it('filters a hidden nested reply from both the tree and direct identity lookup',()=>{
  const root=post('root',{replies:[post('child',{replies:[post('nested')]})]}),index=buildXEntityIndex([root],{},{nested:null});
  expect(findXReplyTree(index,'root')[0].replies).toBeUndefined();expect(index.posts.has('nested')).toBe(false);
 });
 it('collects quotes from imported reply entities and runtime overlay quotes, not feed shells',()=>{
  const quote=post('inline_quote',{quotedPostId:'root'}),index=buildXEntityIndex([post('root')],{another:[quote]},{q:post('q',{quotedPostId:'root'})});
  expect(findXQuotes(index,'root').map(p=>p.id)).toEqual(['inline_quote','q']);
 });
 it('derives reposters only from explicit relationships and deduplicates exact author IDs',()=>{
  const base=[post('source',{stats:{comments:0,retweets:900,likes:0,views:0}}),post('r1',{authorId:'Actor',retweetedPostId:'source'}),post('r2',{authorId:'Actor',retweetedPostId:'source'}),post('r3',{authorId:'actor',retweetedPostId:'source'})];
  expect(findXReposterIds(buildXEntityIndex(base,{},{}),'source','Me',[])).toEqual(['Actor','actor']);
  expect(findXReposterIds(buildXEntityIndex(base,{},{}),'source','Actor',['source'])).toEqual(['Actor','actor']);
 });
 it('reflects actual repost/undo and tombstones without creating fictitious actor metadata',()=>{
  const base=[post('source')],index=buildXEntityIndex(base,{},{});
  expect(findXReposterIds(index,'source','Me',[])).toEqual([]);expect(findXReposterIds(index,'source','Me',['source'])).toEqual(['Me']);
  const hidden=buildXEntityIndex([post('r',{retweetedPostId:'source',authorId:'Actor'})],{},{r:null});expect(findXReposterIds(hidden,'source','Me',[])).toEqual([]);
 });
 it('allows undefined fallback and does not mistake a mismatched runtime key for another entity',()=>{
  const base=post('root');expect(buildXEntityIndex([base],{},{root:undefined}).posts.get('root')).toBe(base);
  expect(buildXEntityIndex([base],{},{root:post('different')}).posts.has('root')).toBe(false);
 });
 it('terminates cyclic/shared objects and reply parent cycles without recursive fake rows',()=>{
  const a=post('a',{threadId:'b'}),b=post('b',{threadId:'a'});a.replies=[b];b.replies=[a];
  const index=buildXEntityIndex([a],{},{});expect(index.posts.size).toBe(2);expect(findXReplyTree(index,'a').map(p=>p.id)).toEqual(['b']);expect(findXReplyTree(index,'a')[0].replies).toBeUndefined();
 });
 it('keeps existing relationship-derived quote statistics without rewriting stored aggregates',()=>{
  const raw=post('q',{quotedPostId:'source',stats:{comments:3,retweets:4,likes:5,views:6}});
  const view=withRelationshipDerivedStats(raw,{id:'Me',likedPostIds:['q'],retweetedPostIds:['q'],followedUserIds:[],followerUserIds:[]},new Map([['q',2]]));
  expect(view.stats).toEqual({comments:5,retweets:5,likes:6,views:6});expect(raw.stats).toEqual({comments:3,retweets:4,likes:5,views:6});
 });

});
