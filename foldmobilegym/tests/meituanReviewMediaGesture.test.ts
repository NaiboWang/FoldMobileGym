import {describe,expect,it} from 'vitest';
import {reviewMediaSwipe} from '../apps/MeituanWaimai/reviewMediaGesture';
const bounds={x:100,y:50,width:300,height:500};
const start={id:1,x:200,y:300,bounds};
const end={id:1,x:100,y:300,bounds};
describe('Meituan gallery swipe ownership and geometry',()=>{
 it('steps in the intended direction at a stable screen rectangle',()=>{expect(reviewMediaSwipe(start,end)).toBe('next');expect(reviewMediaSwipe(start,{...end,x:300})).toBe('previous');});
 it.each(['x','y','width','height'] as const)('rejects changed %s geometry even when CSS content size might be unchanged',key=>expect(reviewMediaSwipe(start,{...end,bounds:{...bounds,[key]:bounds[key]+1}})).toBeNull());
 it('allows harmless subpixel noise',()=>expect(reviewMediaSwipe(start,{...end,bounds:{...bounds,x:100.2}})).toBe('next'));
 it('rejects another pointer',()=>expect(reviewMediaSwipe(start,{...end,id:2})).toBeNull());
 it('rejects short or predominantly vertical drags',()=>{expect(reviewMediaSwipe(start,{...end,x:153})).toBeNull();expect(reviewMediaSwipe(start,{...end,y:200})).toBeNull();});
 it('includes the swipe distance boundary but not the direction-dominance boundary',()=>{expect(reviewMediaSwipe(start,{...end,x:152})).toBe('next');expect(reviewMediaSwipe(start,{...end,x:150,y:340})).toBeNull();});
 it('rejects nonfinite event or geometric coordinates',()=>{expect(reviewMediaSwipe(start,{...end,x:NaN})).toBeNull();expect(reviewMediaSwipe(start,{...end,bounds:{...bounds,width:Infinity}})).toBeNull();});
});
