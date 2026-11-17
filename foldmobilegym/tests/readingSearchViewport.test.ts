import {describe,expect,it} from 'vitest';
import {rememberSearchViewport,SEARCH_VIEWPORT_LIMIT} from '../apps/WechatReading/utils/searchViewport';
describe('Reading search viewport ownership',()=>{
 it('normalizes invalid offsets and updates the same route entry',()=>{const map=new Map();rememberSearchViewport(map,'a',{top:-4,left:NaN});expect(map.get('a')).toEqual({top:0,left:0});rememberSearchViewport(map,'a',{top:12,left:8});expect(map.get('a')).toEqual({top:12,left:8});});
 it('keeps a bounded entry cache without changing query or business records',()=>{const map=new Map();for(let i=0;i<SEARCH_VIEWPORT_LIMIT+5;i++)rememberSearchViewport(map,String(i),{top:i,left:0});expect(map.size).toBe(SEARCH_VIEWPORT_LIMIT);expect(map.has('0')).toBe(false);expect(map.has('5')).toBe(true);});
 it('keeps the logical strip width for changed-posture restoration',()=>{const map=new Map();rememberSearchViewport(map,'wide',{top:30,left:0,width:720});expect(map.get('wide').width).toBe(720);rememberSearchViewport(map,'wide',{top:30,left:20,width:Infinity});expect(map.get('wide').width).toBe(0);});
 it('does not store a missing key',()=>{const map=new Map();rememberSearchViewport(map,'',{top:1,left:2});expect(map.size).toBe(0);});
 it('does not conflate different route entries with matching URL content',()=>{const map=new Map();rememberSearchViewport(map,'first',{top:150,left:30});rememberSearchViewport(map,'second',{top:0,left:0});expect(map.get('first')).toEqual({top:150,left:30});});
 it('does not share bookmarks across Activity providers',()=>{const first=new Map(),second=new Map();rememberSearchViewport(first,'default',{top:99,left:0});expect(second.has('default')).toBe(false);});
});
