import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Gallery/navigation.declaration';
import { rotationGeometry, isStillRotationSource } from '../system/Gallery/rotationGeometry';
describe('Gallery lossless quarter-turn geometry',()=>{
  it.each([0,1,2,3])('preserves the original pixel dimensions at turn %s',q=>{
    expect(rotationGeometry(13,7,q)).toEqual({width:q%2?7:13,height:q%2?13:7,quarterTurns:q});
  });
  it('normalizes repeated and negative turns without resizing',()=>{expect(rotationGeometry(13,7,5)).toEqual(rotationGeometry(13,7,1));expect(rotationGeometry(13,7,-1)).toEqual(rotationGeometry(13,7,3));});
  it.each([[0,1,0],[1,0,0],[NaN,1,0],[1,Infinity,0],[1,1,0.5]])('rejects invalid raster geometry %s',(...args)=>expect(()=>rotationGeometry(...args as [number,number,number])).toThrow());
});

const signature=[137,80,78,71,13,10,26,10];
const chunk=(name:string,data:number[]=[])=>[0,0,0,data.length,...[...name].map(c=>c.charCodeAt(0)),...data,0,0,0,0];
describe('explicit still-image format boundary',()=>{
  it('accepts still PNG structure and JPEG signature for browser decoding',()=>{expect(isStillRotationSource(new Uint8Array([...signature,...chunk('IEND')]),'image/png')).toBe(true);expect(isStillRotationSource(new Uint8Array([255,216,255]),'image/jpeg')).toBe(true);});
  it('rejects APNG rather than silently dropping animation frames',()=>{expect(isStillRotationSource(new Uint8Array([...signature,...chunk('acTL',[0,0,0,2,0,0,0,0]),...chunk('IEND')]),'image/png')).toBe(false);});
  it('parses chunk boundaries rather than searching compressed/text payload for acTL',()=>{expect(isStillRotationSource(new Uint8Array([...signature,...chunk('tEXt',[97,99,84,76]),...chunk('IEND')]),'image/png')).toBe(true);});
  it('rejects truncated, overflowing, mismatched and unsupported input',()=>{for(const bytes of [[],signature,[...signature,...chunk('IDAT').slice(0,10)],[...signature,255,255,255,255,73,68,65,84,0,0,0,0]])expect(isStillRotationSource(new Uint8Array(bytes),'image/png')).toBe(false);expect(isStillRotationSource(new Uint8Array([255,216,255]),'image/png')).toBe(false);expect(isStillRotationSource(new Uint8Array([255,216,255]),'image/gif')).toBe(false);});
});

describe('actual editor navigation surface',()=>{
  it('keeps origin parameters and does not invent a cold-default saved copy',()=>{
    expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='photo.edit.open')).toMatchObject({preserveParams:['album','from','q'],mode:'push'});
    expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='photo.intent.edit.open')).toMatchObject({preserveParams:['image'],mode:'push'});
    expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='photo.edit.copy.open')).toMatchObject({mode:'replace',search:{},ui:{condition:{op:'notEmpty',ref:'media',filterFn:"item => item.mimeType === 'image/png' && item.name.startsWith('edited-')"}}});
  });
  it('gives own and intent editors distinct declared action identities',()=>{
    for(const [path,prefix] of [['/photo/:path','gallery.editor.'],['/intent/view','gallery.intent.editor.']]){
      const route=NAVIGATION_DECLARATION.routes.find(r=>r.path===path)!;
      const state=route.uiStates.find(s=>'modal' in s.search&&s.search.modal==='edit')!;
      expect('actions' in state?state.actions.map(a=>a.id):[]).toEqual(['rotate','reset','save.copy'].map(id=>prefix+id));
    }
  });
});
