import { describe, expect, it } from 'vitest';
import { getXOverlayPostSource } from '../apps/X/utils/overlayPostSource';
import type { XPost } from '../apps/X/types';
const post=(id:string,extra:Partial<XPost>={}):XPost=>({id,authorId:'User',content:'source',time:'just now',stats:{comments:0,retweets:0,likes:0,views:0},...extra});
describe('X modal target source ownership',()=>{
 it('returns exact stable raw base identities without hydration or mutation',()=>{
  const row=post('p_1'),base={posts:[row],replies:{}};expect(getXOverlayPostSource({},base,'p_1')).toBe(row);expect(getXOverlayPostSource({},base,'P_1')).toBeNull();expect(row.content).toBe('source');
 });
 it('honors complete overlays, tombstones and undefined fallback before world lookup',()=>{
  const original=post('p_1'),replacement=post('p_1',{content:'replacement'}),base={posts:[original],replies:{}};
  expect(getXOverlayPostSource({p_1:replacement},base,'p_1')).toBe(replacement);
  expect(getXOverlayPostSource({p_1:null},base,'p_1')).toBeNull();
  expect(getXOverlayPostSource({p_1:undefined},base,'p_1')).toBe(original);
 });
 it('resolves loaded root/nested replies and does not resurrect an explicit hidden reply',()=>{
  const row=post('r_p_1_0'),nested=post('r_p_1_0_1');row.replies=[nested];const base={posts:[],replies:{p_1:[row]}};
  expect(getXOverlayPostSource({},base,nested.id)).toBe(nested);expect(getXOverlayPostSource({[nested.id]:null},base,nested.id)).toBeNull();
 });
 it('supports inline runtime reply and embedded retweet sources, including shared/cyclic references',()=>{
  const target=post('inline'),parent=post('parent',{replies:[target]});parent.retweetedPost=parent;
  expect(getXOverlayPostSource({parent},{posts:[],replies:{}},'inline')).toBe(target);
  expect(getXOverlayPostSource({parent},{posts:[],replies:{}},'missing')).toBeNull();
 });
 it('detects same-ID replacement as a different source and never substitutes an unrelated post',()=>{
  const first=post('p_1'),second=post('p_1',{content:'new'}),base={posts:[first],replies:{}};
  const owner=getXOverlayPostSource({},base,'p_1');expect(getXOverlayPostSource({p_1:second},base,'p_1')).not.toBe(owner);
  expect(getXOverlayPostSource({},base,'unknown')).toBeNull();expect(getXOverlayPostSource({},base,'retweet_p_1')).toBeNull();expect(getXOverlayPostSource({},base,'')).toBeNull();
 });
});
