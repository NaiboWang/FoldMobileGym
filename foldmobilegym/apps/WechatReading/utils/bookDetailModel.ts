import type {Book,Audiobook,ReadingRecord} from '../data/types';
export type DetailBook=Omit<Partial<Book>,'rating'>&{id:string;title:string;author:string;rating?:number|string;plays?:string;isAudio:boolean};
export function resolveDetailBook(id:string|undefined,books:readonly Book[],audio:readonly Audiobook[]):DetailBook|null {
 if(!id)return null;
 const matches:DetailBook[]=[...books.filter(b=>b.id===id).map(b=>({...b,isAudio:false,recommendedValue:typeof b.recommendedValue==='number'&&Number.isFinite(b.recommendedValue)&&b.recommendedValue>=0&&b.recommendedValue<=100?b.recommendedValue:undefined})),...audio.filter(b=>b.id===id).map(b=>({...b,isAudio:true,recommendedValue:typeof b.rating==='string'&&/^(?:\d+(?:\.\d+)?)%$/.test(b.rating)&&Number(b.rating.slice(0,-1))<=100?Number(b.rating.slice(0,-1)):undefined}))];
 return matches.length===1?matches[0]:null;
}
export function recordedBookMinutes(records:readonly ReadingRecord[],id:string):number|null {
 const sum=records.filter(r=>r.bookId===id&&typeof r.duration==='number'&&Number.isFinite(r.duration)&&r.duration>=0).reduce((total,r)=>total+r.duration,0);
 return Number.isFinite(sum)?sum:null;
}
export function detailReviewWidths(book:Pick<Book,'reviewBreakdown'|'totalReviews'>){
 const r=book.reviewBreakdown;if(!r||!Object.values(r).every(n=>Number.isSafeInteger(n)&&n>=0))return null;
 const sum=r.recommended+r.average+r.notRecommended;
 if(!Number.isSafeInteger(sum)||(book.totalReviews!==undefined&&sum!==book.totalReviews))return null;
 return {recommended:sum?r.recommended/sum*100:0,average:sum?r.average/sum*100:0,notRecommended:sum?r.notRecommended/sum*100:0};
}
export function bookDetailBackPath(location:{pathname:string;search:string},previous?:{pathname:string;search:string}):string|null {
 if(!/^\/book\/[^/]+$/.test(location.pathname))return null;
 const params=new URLSearchParams(location.search);
 if(params.get('modal')==='shelf'){
  params.delete('modal');const owner=location.pathname+(params.size?'?'+params.toString():'');
  return previous&&previous.pathname+previous.search===owner?null:owner;
 }
 return previous?null:'/bookshelf';
}
