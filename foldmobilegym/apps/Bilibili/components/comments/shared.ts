import type React from 'react';
import { useAppStrings } from '../../../../os/useAppStrings';
import { useLocale } from '../../locale';
import { strings } from '../../res/strings';
import { stringsEn } from '../../res/strings.en';
export function useCommentStrings(){return useAppStrings(strings,stringsEn,useLocale());}
export const fill=(text:string,values:Record<string,string|number>)=>Object.entries(values).reduce((value,[key,next])=>value.replaceAll(`{${key}}`,String(next)),text);
export function owned<T extends HTMLElement>(props:React.HTMLAttributes<T>,active:()=>boolean):React.HTMLAttributes<T> {
  return {...props,onClick:event=>{if(active()&&!event.currentTarget.closest('[inert]'))props.onClick?.(event);}};
}
