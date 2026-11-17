import {describe,expect,it} from 'vitest';
import {resolveDetailBook,recordedBookMinutes,detailReviewWidths,bookDetailBackPath} from '../apps/WechatReading/utils/bookDetailModel';
import type {Book,Audiobook,ReadingRecord} from '../apps/WechatReading/data/types';
const books:Book[]=[{id:'a',title:'Synthetic title',author:'Synthetic author',totalWords:10,recommendedValue:0}],audio:Audiobook[]=[{id:'audio',title:'Synthetic audio',author:'Synthetic author',coverColor:'#fff',plays:'10',rating:'96.2%'}];
describe('Reading details follow exact source records',()=>{
 it('keeps the source unchanged and resolves the requested record',()=>{const before=JSON.stringify(books);expect(resolveDetailBook('a',books,audio)).toMatchObject({...books[0],isAudio:false});expect(JSON.stringify(books)).toBe(before);});
 it.each([undefined,'','missing',' a'])('does not reuse another book for %s',id=>expect(resolveDetailBook(id,books,audio)).toBeNull());
 it('rejects duplicate IDs, including collisions between book and audio catalog',()=>{expect(resolveDetailBook('a',[...books,...books],audio)).toBeNull();expect(resolveDetailBook('a',books,[{...audio[0],id:'a'}])).toBeNull();});
 it('keeps audio counts verbatim and parses only actual percentage ratings',()=>{expect(resolveDetailBook('audio',books,audio)).toMatchObject({plays:'10',recommendedValue:96.2,isAudio:true});expect(resolveDetailBook('audio',books,[{...audio[0],rating:'unknown'}])?.recommendedValue).toBeUndefined();});
 it.each([-1,101,NaN,Infinity])('does not publish invalid percentage %s',recommendedValue=>expect(resolveDetailBook('a',[{...books[0],recommendedValue}],audio)?.recommendedValue).toBeUndefined());
 it('sums only this book actual nonnegative finite reading durations',()=>expect(recordedBookMinutes([{bookId:'a',duration:3},{bookId:'b',duration:100},{bookId:'a',duration:-1},{bookId:'a',duration:Infinity},{bookId:'a',duration:'12'},{bookId:'a',duration:.5}] as ReadingRecord[],'a')).toBe(3.5));
 it('knows an empty local reading history is zero, not twelve minutes',()=>expect(recordedBookMinutes([],'a')).toBe(0));
 it('rejects an overflowed aggregate',()=>expect(recordedBookMinutes([{bookId:'a',duration:Number.MAX_VALUE},{bookId:'a',duration:Number.MAX_VALUE}] as ReadingRecord[],'a')).toBeNull());
 it('computes actual review shares rather than the same 92/6/1 bars',()=>expect(detailReviewWidths({totalReviews:10,reviewBreakdown:{recommended:2,average:3,notRecommended:5}})).toEqual({recommended:20,average:30,notRecommended:50}));
 it('does not fabricate absent or inconsistent review distributions',()=>{expect(detailReviewWidths({})).toBeNull();expect(detailReviewWidths({totalReviews:9,reviewBreakdown:{recommended:2,average:3,notRecommended:5}})).toBeNull();expect(detailReviewWidths({reviewBreakdown:{recommended:-1,average:1,notRecommended:0}})).toBeNull();});
 it('accepts a known all-zero distribution without dividing by zero',()=>expect(detailReviewWidths({reviewBreakdown:{recommended:0,average:0,notRecommended:0}})).toEqual({recommended:0,average:0,notRecommended:0}));
});
describe('Book detail Back owner',()=>{
 const current={pathname:'/book/a',search:'?trace=keep&modal=shelf'},owner={pathname:'/book/a',search:'?trace=keep'};
 it('repairs cold entry without losing owner parameters',()=>expect(bookDetailBackPath(current)).toBe('/book/a?trace=keep'));
 it('pops a verified owner but never an unrelated previous page',()=>{expect(bookDetailBackPath(current,owner)).toBeNull();expect(bookDetailBackPath(current,{pathname:'/book/b',search:''})).toBe('/book/a?trace=keep');});
 it('returns a cold book page to its shelf and leaves existing history alone',()=>{expect(bookDetailBackPath(owner)).toBe('/bookshelf');expect(bookDetailBackPath(owner,{pathname:'/search',search:'?query=a'})).toBeNull();});
 it('does not change reader, shelf or unrelated routes',()=>{for(const pathname of ['/read/a','/bookshelf','/book/a/other'])expect(bookDetailBackPath({pathname,search:''})).toBeNull();});
});
