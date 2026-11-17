export type SearchViewport={top:number;left:number;width?:number};
export const SEARCH_VIEWPORT_LIMIT=40;
export function rememberSearchViewport(cache:Map<string,SearchViewport>,key:string,value:SearchViewport){
 if(!key)return;
 const clean=(n:number)=>Number.isFinite(n)&&n>=0?n:0;
 cache.delete(key);cache.set(key,{top:clean(value.top),left:clean(value.left),...(value.width===undefined?{}:{width:clean(value.width)})});
 while(cache.size>SEARCH_VIEWPORT_LIMIT)cache.delete(cache.keys().next().value!);
}
