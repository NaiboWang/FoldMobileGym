import {describe, expect, it} from 'vitest';
import {sameViewerGeometry} from '../system/Gallery/resizeGeometry';
import type {PinchGeometry} from '../system/Gallery/pinchGeometry';
const make=():PinchGeometry=>({hostScale:1,width:360,height:800,imageWidth:320,imageHeight:700,center:{x:500,y:500}});
describe('Gallery observer geometry versus active input',()=>{
 it('accepts a first or duplicate notification with the same measured geometry',()=>{expect(sameViewerGeometry(make(),make())).toBe(true);});
 it.each(['hostScale','width','height','imageWidth','imageHeight'] as const)('rejects changed %s',key=>{const next=make();next[key]+=1;expect(sameViewerGeometry(make(),next)).toBe(false);});
 it('rejects an actual host translation',()=>{const next=make();next.center.x++;expect(sameViewerGeometry(make(),next)).toBe(false);});
 it('rejects missing, hidden or nonfinite measurement',()=>{expect(sameViewerGeometry(make(),null)).toBe(false);const hidden=make();hidden.width=0;expect(sameViewerGeometry(hidden,{...hidden})).toBe(false);const next=make();next.width=NaN;expect(sameViewerGeometry(make(),next)).toBe(false);});
});
