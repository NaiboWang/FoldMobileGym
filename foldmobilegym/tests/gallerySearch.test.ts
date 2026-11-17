import { describe, expect, it } from 'vitest';
import { searchMedia } from '../system/Gallery/mediaSearch';
import type { MediaItem } from '../os/types';
import * as TimeService from '../os/TimeService';
const make = (name:string, createdAt=TimeService.fromLocalParts(2026,8,1).getTime()):MediaItem => ({ id:name, name, path:'/sdcard/Pictures/'+name, type:'image', mimeType:'image/jpeg', uri:'', size:10, createdAt });
describe('actual local Gallery metadata search', () => {
  it('does not invent recent or semantic matches for an empty query', () => {
    expect(searchMedia([make('lake.jpg')], '  ')).toEqual([]);
  });
  it('matches file names and actual parent paths case-insensitively', () => {
    const item=make('PHOTO_001.jpg');
    expect(searchMedia([item], 'pictures photo_001')).toEqual([item]);
  });
  it('normalises compatibility characters while preserving literal punctuation', () => {
    const item=make('照片%2F[1].jpg');
    expect(searchMedia([item], '照片％２Ｆ[１]')).toEqual([item]);
    expect(searchMedia([item], '.*')).toEqual([]);
  });
  it('requires all whitespace-separated terms to match the same media item', () => {
    expect(searchMedia([make('lake.jpg'),make('mountain.jpg')], 'lake mountain')).toEqual([]);
  });
  it('uses real local creation dates in ISO, slash and Chinese forms', () => {
    const item=make('photo.jpg');
    for(const q of ['2026-09','2026/9/1','2026年9月1日']) expect(searchMedia([item],q)).toEqual([item]);
    expect(searchMedia([item],'2026-10')).toEqual([]);
  });
  it('returns every match newest first, without mutating or truncating the source', () => {
    const items=Array.from({length:250},(_,n)=>make(`photo_${n}.jpg`,1000+n));
    const result=searchMedia(items,'photo_');
    expect(result).toHaveLength(250); expect(result[0]).toBe(items[249]); expect(items[0].createdAt).toBe(1000);
  });
  it('does not fabricate date matches for invalid timestamps', () => {
    expect(searchMedia([make('photo.jpg',NaN)],'NaN')).toEqual([]);
  });
});
