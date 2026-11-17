import {describe,expect,it} from 'vitest';
import {readReviewMediaRequest,resolveReviewMedia,reviewMediaOwnerPath,reviewMediaBackDelta,reviewMediaSourceKey} from '../apps/MeituanWaimai/reviewMedia';
import type {Shop,ShopReview} from '../apps/MeituanWaimai/types';
const reviews:ShopReview[]=[{id:'a',author:'Synthetic A',text:'Synthetic review',images:['/assets/1.png','/assets/2.png']}];
const owner={pathname:'/shop/reviews/reviews',search:'?origin=%2F%3Fsearch%3Dopen&reviewFilter=media&menuCategory=food'};
const media={...owner,search:owner.search+'&reviewMedia=a&reviewMediaIndex=1'};
describe('Meituan exact review photo requests',()=>{
 it('distinguishes no modal from an explicit source request',()=>{expect(readReviewMediaRequest('?reviewFilter=media')).toEqual({kind:'closed'});expect(readReviewMediaRequest('?reviewMedia=a&reviewMediaIndex=0')).toEqual({kind:'open',reviewId:'a',index:0});});
 it.each(['?reviewMedia=a','?reviewMediaIndex=0','?reviewMedia=&reviewMediaIndex=0','?reviewMedia=a&reviewMedia=a&reviewMediaIndex=0','?reviewMedia=a&reviewMediaIndex=0&reviewMediaIndex=1',...['','-1','-0','01','1.0','1e0','+1','NaN','Infinity','9007199254740993'].map(v=>'?reviewMedia=a&reviewMediaIndex='+encodeURIComponent(v))])('rejects missing/ambiguous/noncanonical selection %s',search=>expect(readReviewMediaRequest(search)).toEqual({kind:'invalid'}));
 it('resolves only the requested source and index without changing it',()=>{const before=JSON.stringify(reviews);expect(resolveReviewMedia({kind:'open',reviewId:'a',index:1},reviews)).toMatchObject({kind:'open',index:1,images:reviews[0].images});expect(JSON.stringify(reviews)).toBe(before);});
 it.each([null,undefined,[]])('does not invent photo records for missing source %j',source=>expect(resolveReviewMedia({kind:'open',reviewId:'a',index:0},source)).toEqual({kind:'unavailable'}));
 it.each([['unknown',0],['a',-1],['a',2],['a',NaN]] as Array<[string,number]>)('rejects unavailable source/index %s %s',(reviewId,index)=>expect(resolveReviewMedia({kind:'open',reviewId,index},reviews)).toEqual({kind:'unavailable'}));
 it('preserves a closed request even without source data',()=>expect(resolveReviewMedia({kind:'closed'},null)).toEqual({kind:'closed'}));
 it('source revisions distinguish changed photos and legacy versus invalid data',()=>{const shop={id:'fixture',reviews} as Shop;expect(reviewMediaSourceKey(shop)).not.toBe(reviewMediaSourceKey({...shop,reviews:[{...reviews[0],images:['/assets/other.png']}]}));expect(reviewMediaSourceKey({...shop,reviews:undefined})).not.toBe(reviewMediaSourceKey({...shop,reviews:null as any}));});
});
describe('Meituan media owner history',()=>{
 it('removes only media state and retains source/category/filter',()=>expect(reviewMediaOwnerPath(media)).toBe(owner.pathname+owner.search));
 it('pops a verified reviews owner',()=>expect(reviewMediaBackDelta([owner,media],1,media)).toBe(-1));
 it('unwinds contiguous duplicate gallery records',()=>expect(reviewMediaBackDelta([owner,media,media],2,media)).toBe(-2));
 it('does not pop an unrelated page or another review context',()=>{expect(reviewMediaBackDelta([{pathname:'/',search:''},media],1,media)).toBe(0);expect(reviewMediaBackDelta([{...owner,search:'?reviewFilter=negative'},media],1,media)).toBe(0);});
 it('does not search across an unrelated entry for an older match',()=>expect(reviewMediaBackDelta([owner,{pathname:'/cart',search:''},media],2,media)).toBe(0));
 it('handles encoded-equivalent owner queries without creating a duplicate',()=>{const prior={pathname:owner.pathname,search:'?origin=%2F&extra=a%20b'},current={...prior,search:'?origin=%2F&extra=a+b&reviewMedia=a&reviewMediaIndex=0'};expect(reviewMediaBackDelta([prior,current],1,current)).toBe(-1);});
});
