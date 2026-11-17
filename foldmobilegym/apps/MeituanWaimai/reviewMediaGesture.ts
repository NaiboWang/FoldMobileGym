export type ReviewMediaBounds = {x:number;y:number;width:number;height:number};
export type ReviewMediaDrag = {id:number;x:number;y:number;bounds:ReviewMediaBounds};
/** Screen geometry matters: shell scaling need not change CSS content-box sizes. */
export function reviewMediaSwipe(start:ReviewMediaDrag,end:{id:number;x:number;y:number;bounds:ReviewMediaBounds}):'previous'|'next'|null {
  if(start.id!==end.id)return null;
  for(const key of ['x','y','width','height'] as const){
    if(!Number.isFinite(start.bounds[key])||!Number.isFinite(end.bounds[key])||Math.abs(start.bounds[key]-end.bounds[key])>.5)return null;
  }
  const dx=end.x-start.x,dy=end.y-start.y;
  return Number.isFinite(dx)&&Number.isFinite(dy)&&Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.25?(dx<0?'next':'previous'):null;
}
