import {describe, expect, it} from 'vitest';
import {sortShelfItems} from '../apps/WechatReading/utils/shelfSort';
import {setShelfPinned} from '../apps/WechatReading/utils/shelfPin';
const rows = [
  {bookId:'a',isPrivate:false,addedAt:'a',book:{id:'a',title:'Alpha',author:'x',totalWords:10}},
  {bookId:'b',isPrivate:true,addedAt:'b',book:{id:'b',title:'Beta',author:'y',totalWords:20}},
  {bookId:'c',isPrivate:false,addedAt:'c',book:{id:'c',title:'Charlie',author:'z',totalWords:30}},
];
describe('local shelf pinning',()=>{
  it('sets and clears only selected entries without mutating metadata or input',()=>{
    const before=JSON.stringify(rows);const pinned=setShelfPinned(rows,['c','a'],true);
    expect(pinned.map(x=>[x.bookId,x.isPinned===true])).toEqual([['a',true],['b',false],['c',true]]);
    expect(pinned[1]).toBe(rows[1]); expect(JSON.stringify(rows)).toBe(before);
    expect(setShelfPinned(pinned,['a'],false).map(x=>x.isPinned===true)).toEqual([false,false,true]);
    expect(setShelfPinned(pinned,['missing'],true)).toBe(pinned);
  });
  it('retains pin priority with stable local order across sort modes',()=>{
    const pinned=setShelfPinned(rows,['c'],true);
    expect(sortShelfItems(pinned,'default').map(x=>x.bookId)).toEqual(['c','a','b']);
    expect(sortShelfItems(pinned,'words').map(x=>x.bookId)).toEqual(['c','b','a']);
  });
});
