import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {fromLocalParts,fromTimestamp} from '../os/TimeService';
import {computeOpeningStatusFromPeriods} from '../apps/Map/utils/placeUtils';
const p=(day:number,hour:number,minute=0)=>({day,hour,minute});
const period=(day:number,open:number,closeDay:number,close:number)=>({open:p(day,open),close:p(closeDay,close)});
const at=(day:number,hour:number,minute=0)=>fromLocalParts(2026,10,1+day,hour,minute);
const status=(periods:unknown[],day:number,hour:number,minute=0,locale:'en'|'zh-Hans'='en')=>computeOpeningStatusFromPeriods({periods},at(day,hour,minute),locale);
describe('Map weekly opening-hours boundaries',()=>{
 it('opens at the inclusive opening boundary',()=>expect(status([period(1,9,1,17)],1,9).isOpen).toBe(true));
 it('closes at the exclusive closing boundary',()=>expect(status([period(1,9,1,17)],1,17).isOpen).toBe(false));
 it('keeps a next-day closing interval open before midnight',()=>expect(status([period(1,22,2,2)],1,23)).toMatchObject({isOpen:true,closesAt:'02:00'}));
 it('keeps the same interval open after midnight',()=>expect(status([period(1,22,2,2)],2,1)).toMatchObject({isOpen:true,closesAt:'02:00'}));
 it('closes an overnight interval at the actual next-day boundary',()=>expect(status([period(1,22,2,2)],2,2).isOpen).toBe(false));
 it('supports Saturday to Sunday wrap-around',()=>expect(status([period(6,22,0,3)],0,1)).toMatchObject({isOpen:true,closesAt:'03:00'}));
 it('supports an explicit multi-day interval',()=>expect(status([period(1,9,3,17)],2,15)).toMatchObject({isOpen:true,closesAt:'17:00'}));
 it('uses the union of overlapping windows for the real closing time',()=>expect(status([period(1,9,1,13),period(1,12,1,18)],1,10).closesAt).toBe('18:00'));
 it('merges touching windows instead of reporting a false close',()=>expect(status([period(1,9,1,12),period(1,12,1,18)],1,10).closesAt).toBe('18:00'));
 it('preserves real lunch breaks',()=>expect(status([period(1,9,1,12),period(1,14,1,18)],1,13)).toMatchObject({isOpen:false,opensNextLabel:'Mon 14:00'}));
 it.each([0,1,2,3,4,5,6])('recognizes the 24/7 sentinel on day %i',day=>expect(status([{open:p(0,0)}],day,15)).toMatchObject({isOpen:true,closesAt:null}));
 it('recognizes continuous opening formed by seven daily windows',()=>expect(status(Array.from({length:7},(_,day)=>period(day,0,(day+1)%7,0)),2,14)).toMatchObject({isOpen:true,isAlwaysOpen:true,closesAt:null}));
 it('finds the next opening across the week boundary',()=>expect(status([period(1,9,1,17)],6,22).opensNextLabel).toBe('Mon 09:00'));
 it('localizes Chinese weekday labels without changing the business interval',()=>expect(status([period(1,9,1,17)],6,22,0,'zh-Hans').opensNextLabel).toBe('周一09:00'));
 it('treats missing schedule data as unknown rather than a known closure',()=>expect(status([],1,12)).toMatchObject({isKnown:false,isOpen:false}));
 it.each([null,{open:p(9,9),close:p(9,17)},{open:p(1,25),close:p(1,17)},{open:p(1,9,99),close:p(1,17)},{open:p(2,9)}])('ignores malformed/truncated period %j',bad=>expect(status([bad],1,12)).toMatchObject({isKnown:false}));
 it('ignores invalid neighbors while preserving valid intervals',()=>expect(status([null,period(1,9,1,17)],1,12)).toMatchObject({isKnown:true,isOpen:true}));
 it('rejects an invalid observation time',()=>expect(computeOpeningStatusFromPeriods({periods:[period(1,9,1,17)]},fromTimestamp(NaN))).toMatchObject({isKnown:false}));
 it('correctly evaluates every existing overnight period without changing the snapshot',()=>{
  const snapshot=JSON.parse(readFileSync(new URL('../apps/Map/data/places.json',import.meta.url),'utf8'));
  const periods=Object.values(snapshot.places).flatMap((row:any)=>row.details?.regularOpeningHours?.periods??[]).filter((pr:any)=>pr.close&&pr.open?.day!==pr.close.day);
  expect(periods.length).toBeGreaterThan(0);
  for(const pr of periods){const end=pr.close.day*1440+pr.close.hour*60+pr.close.minute;const minute=(end-1+10080)%10080;expect(status([pr],Math.floor(minute/1440),Math.floor(minute%1440/60),minute%60).isOpen,JSON.stringify(pr)).toBe(true);}
 });
});
