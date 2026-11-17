import type {ShelfItem} from '../data/types';
/** A detail menu belongs to exactly one actual shelf record, not just a book ID. */
export function detailShelfEntry(bookId:string|undefined,shelf:readonly ShelfItem[]):ShelfItem|null {
 if(!bookId)return null;
 const entries=shelf.filter(item=>item.bookId===bookId);
 return entries.length===1?entries[0]:null;
}
/** Submit the rendered intent once. Never invert a more recent, unseen value. */
export function detailPrivacyCommand(bookId:string,rendered:ShelfItem|null,live:readonly ShelfItem[],target:boolean){
 if(!rendered||rendered.bookId!==bookId||typeof target!=='boolean'||typeof rendered.isPrivate!=='boolean'
   ||detailShelfEntry(bookId,live)!==rendered||rendered.isPrivate===target)return null;
 return {bookId,isPrivate:target};
}
