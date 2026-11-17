import {describe,expect,it} from 'vitest';
import {createSheet,hasUnsentPost,discardBackSteps} from '../apps/Reddit/createOverlayPolicy';
describe('Reddit URL-owned create overlay policy',()=>{
 it('recognizes only actual declared sheets, not partial names or unknown values',()=>{
  expect(createSheet('?sheet=flair')).toBe('flair');expect(createSheet('?sheet=discard')).toBe('discard');
  for(const search of ['', '?sheet=unknown','?sheet=FLAIR','?flair=1'])expect(createSheet(search)).toBeNull();
 });
 it('protects text even without publishable title/body combinations',()=>{
  expect(hasUnsentPost('Title only','',[])).toBe(true);expect(hasUnsentPost('','Text only',[])).toBe(true);
  expect(hasUnsentPost(' ','',[])).toBe(true);expect(hasUnsentPost('','',[])).toBe(false);
 });
 it('protects image-only unsent content without treating a media reference as uploaded data',()=>{
  expect(hasUnsentPost('','',['simfs-image:original-file'])).toBe(true);
 });
 it('returns from a real child sheet through its editor to the original source',()=>{
  expect(discardBackSteps(2,true)).toBe(2);expect(discardBackSteps(7,true)).toBe(2);
 });
 it('does not rewind beyond index zero or pretend a cold sheet has an editor parent',()=>{
  for(const index of [0,1])expect(discardBackSteps(index,true)).toBeNull();
  expect(discardBackSteps(2,false)).toBeNull();
 });
});
