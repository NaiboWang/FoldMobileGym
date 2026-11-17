import {describe,expect,it} from 'vitest';
import * as TimeService from '../os/TimeService';
import {noteLibraryGreeting} from '../system/Notes/referenceLibrary';
import {strings} from '../system/Notes/res/strings';
import {stringsEn} from '../system/Notes/res/strings.en';
import {resolveAppStrings} from '../os/useAppStrings';
const at=(hour:number,minute=0)=>TimeService.fromLocalParts(2026,1,5,hour,minute).getTime();
describe('Notes source-library greeting is presentation of the unified clock',()=>{
 for(const locale of ['zh-Hans','en'] as const){
  const s=resolveAppStrings(strings,stringsEn,locale);
  for(const [hour,minute,key] of [[0,0,'library_greeting_evening'],[4,59,'library_greeting_evening'],[5,0,'library_greeting_morning'],[11,59,'library_greeting_morning'],[12,0,'library_greeting_afternoon'],[17,59,'library_greeting_afternoon'],[18,0,'library_greeting_evening'],[23,59,'library_greeting_evening']] as const){
   it(`${locale} selects the ${key} band at ${hour}:${minute}`,()=>expect(noteLibraryGreeting(at(hour,minute),s)).toBe(s[key]));
  }
  it(`${locale} rejects invalid clocks rather than inventing a timestamp`,()=>{for(const invalid of [NaN,Infinity,-Infinity,Number.MAX_VALUE])expect(noteLibraryGreeting(invalid,s)).toBe(s.library_greeting_generic);});
  it(`${locale} handles epoch and backward changes without stored greeting state`,()=>{expect(noteLibraryGreeting(at(21),s)).toBe(s.library_greeting_evening);expect(noteLibraryGreeting(at(9),s)).toBe(s.library_greeting_morning);expect(noteLibraryGreeting(0,s)).not.toBe(s.library_greeting_generic);});
 }
});
