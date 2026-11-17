import type { Shop, ShopReview } from './types';
import { meituanReviewSource } from './reviewModel';
export type ReviewMediaRequest = {kind:'closed'}|{kind:'invalid'}|{kind:'open';reviewId:string;index:number};
export function readReviewMediaRequest(search:string):ReviewMediaRequest {
  const params=new URLSearchParams(search),ids=params.getAll('reviewMedia'),indices=params.getAll('reviewMediaIndex');
  if(!ids.length&&!indices.length)return{kind:'closed'};
  if(ids.length!==1||!ids[0]||indices.length!==1||!/^(0|[1-9]\d*)$/.test(indices[0]))return{kind:'invalid'};
  const index=Number(indices[0]);
  return Number.isSafeInteger(index)?{kind:'open',reviewId:ids[0],index}:{kind:'invalid'};
}
export type ReviewMediaView={kind:'closed'}|{kind:'unavailable'}|{kind:'open';review:ShopReview;images:string[];index:number};
export function resolveReviewMedia(request:ReviewMediaRequest,reviews:readonly ShopReview[]|null|undefined):ReviewMediaView {
  if(request.kind==='closed')return request;
  if(request.kind==='invalid')return{kind:'unavailable'};
  const review=reviews?.find(r=>r.id===request.reviewId),images=review?.images;
  return review&&images&&Number.isSafeInteger(request.index)&&request.index>=0&&request.index<images.length
    ?{kind:'open',review,images,index:request.index}:{kind:'unavailable'};
}
export const reviewMediaSourceKey=(shop:Shop|undefined)=>shop?JSON.stringify([shop.id,meituanReviewSource(shop)===undefined?'legacy':meituanReviewSource(shop)]):'';
export function reviewMediaOwnerPath(location:{pathname:string;search:string}) {
  const params=new URLSearchParams(location.search);params.delete('reviewMedia');params.delete('reviewMediaIndex');
  return location.pathname+(params.size?'?'+params.toString():'');
}
/** Pop only a verified owning reviews entry, never an unrelated prior page. */
export function reviewMediaBackDelta(stack:readonly {pathname:string;search:string}[],index:number,location:{pathname:string;search:string}) {
  const owner=reviewMediaOwnerPath(location);
  for(let cursor=index-1;cursor>=0;cursor--){
    const previous=stack[cursor];
    if(!previous||reviewMediaOwnerPath(previous)!==owner)break;
    if(readReviewMediaRequest(previous.search).kind==='closed')return cursor-index;
  }
  return 0;
}
