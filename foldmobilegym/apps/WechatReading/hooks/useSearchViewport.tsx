import React,{createContext,useContext,useLayoutEffect,useRef,useState} from 'react';
import {rememberSearchViewport,type SearchViewport} from '../utils/searchViewport';
const Context=createContext<Map<string,SearchViewport>|null>(null);
/** UI-only bookmarks belong to one router/Activity, never to the shared business store. */
export function ReadingSearchViewportProvider({children}:{children:React.ReactNode}){
 const [cache]=useState(()=>new Map<string,SearchViewport>());
 return <Context.Provider value={cache}>{children}</Context.Provider>;
}
export function useSearchViewport(key:string,ready:boolean){
 const provided=useContext(Context),[local]=useState(()=>new Map<string,SearchViewport>()),cache=provided??local;
 const main=useRef<HTMLDivElement>(null),tabs=useRef<HTMLDivElement>(null);
 const restoring=cache.has(key);
 const save=()=>{const node=main.current;if(!ready||!node?.isConnected||!node.checkVisibility())return;rememberSearchViewport(cache,key,{top:node.scrollTop,left:tabs.current?.scrollLeft??0,width:tabs.current?.clientWidth});};
 useLayoutEffect(()=>{
  const node=main.current,strip=tabs.current;if(!node||!ready)return;
  const saved=cache.get(key);node.scrollTop=saved?.top??0;if(strip)strip.scrollLeft=saved?.left??0;
  const align=()=>{const active=strip?.querySelector<HTMLElement>('[aria-current="page"]');if(!strip||!active)return;const r=strip.getBoundingClientRect(),a=active.getBoundingClientRect(),scale=r.width?strip.clientWidth/r.width:1;if(a.left<r.left)strip.scrollLeft-=(r.left-a.left)*scale;else if(a.right>r.right)strip.scrollLeft+=(a.right-r.right)*scale;};
  if(!saved||(strip&&saved.width!==undefined&&saved.width!==strip.clientWidth))align();
  const record=()=>{if(node.isConnected&&node.checkVisibility())rememberSearchViewport(cache,key,{top:node.scrollTop,left:strip?.scrollLeft??0,width:strip?.clientWidth});};
  node.addEventListener('scroll',record,{passive:true});strip?.addEventListener('scroll',record,{passive:true});
  let previous=strip?.clientWidth;const observer=new ResizeObserver(()=>{if(strip&&strip.clientWidth!==previous){previous=strip.clientWidth;align();}});if(strip)observer.observe(strip);
  return()=>{node.removeEventListener('scroll',record);strip?.removeEventListener('scroll',record);observer.disconnect();};
 },[cache,key,ready]);
 return{main,tabs,restoring,save};
}
