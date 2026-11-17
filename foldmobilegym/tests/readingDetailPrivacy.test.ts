import {describe,expect,it} from 'vitest';
import {detailShelfEntry,detailPrivacyCommand} from '../apps/WechatReading/utils/bookDetailPrivacy';
import type {ShelfItem} from '../apps/WechatReading/data/types';
const entry:ShelfItem={bookId:'existing',isPrivate:false,addedAt:'2026-01-01T00:00:00Z'};
describe('Source-owned detail privacy submit',()=>{
 it('resolves one actual shelf source without cloning it',()=>expect(detailShelfEntry('existing',[entry])).toBe(entry));
 it.each([undefined,'','missing'])('rejects a missing book source %s',id=>expect(detailShelfEntry(id,[entry])).toBeNull());
 it('rejects duplicate source IDs rather than mutating both',()=>{expect(detailShelfEntry('existing',[entry,{...entry}])).toBeNull();expect(detailPrivacyCommand('existing',entry,[entry,{...entry}],true)).toBeNull();});
 it('emits an explicit private intent without changing the source',()=>{const before=JSON.stringify(entry);expect(detailPrivacyCommand('existing',entry,[entry],true)).toEqual({bookId:'existing',isPrivate:true});expect(JSON.stringify(entry)).toBe(before);});
 it('restores public through the same explicit intent',()=>{const privateEntry={...entry,isPrivate:true};expect(detailPrivacyCommand('existing',privateEntry,[privateEntry],false)).toEqual({bookId:'existing',isPrivate:false});});
 it('does not invert an already-committed flag on a duplicate click',()=>{expect(detailPrivacyCommand('existing',entry,[entry],false)).toBeNull();const committed={...entry,isPrivate:true};expect(detailPrivacyCommand('existing',entry,[committed],true)).toBeNull();});
 it('rejects a removed or newly re-added record even with the same book ID',()=>{expect(detailPrivacyCommand('existing',entry,[],true)).toBeNull();expect(detailPrivacyCommand('existing',entry,[{...entry}],true)).toBeNull();});
 it('does not bind a rendered record to another book',()=>expect(detailPrivacyCommand('other',entry,[entry],true)).toBeNull());
 it('ignores unrelated shelf updates without requiring a whole-array lock',()=>expect(detailPrivacyCommand('existing',entry,[{...entry,bookId:'other'},entry],true)).toEqual({bookId:'existing',isPrivate:true}));
 it.each([null,undefined,0,'true'])('rejects a malformed target %s',target=>expect(detailPrivacyCommand('existing',entry,[entry],target as any)).toBeNull());
 it('rejects a source without a known privacy flag',()=>{const invalid={...entry,isPrivate:undefined} as any;expect(detailPrivacyCommand('existing',invalid,[invalid],true)).toBeNull();});
 it('rejects an absent rendered source',()=>expect(detailPrivacyCommand('existing',null,[entry],true)).toBeNull());
});
