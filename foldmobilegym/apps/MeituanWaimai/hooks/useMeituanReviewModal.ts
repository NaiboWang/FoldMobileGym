import {useEffect,useLayoutEffect,useRef,type RefObject} from 'react';
import {TaskManager} from '@/os/TaskManager';
import {reviewMediaSwipe,type ReviewMediaDrag} from '../reviewMediaGesture';
import {useActivityId} from '@/os/ActivityContext';
import {isMeituanForegroundActivity,useMeituanInteractionOwner} from './useMeituanInteractionOwner';

/** Inert only this Activity's background; never a sibling OS split pane. */
export function useMeituanReviewModal(active:boolean,dialog:RefObject<HTMLDivElement|null>,revision:string,onStep:(direction:'previous'|'next')=>void,onClose:()=>void) {
  const owns=useMeituanInteractionOwner(),activityId=useActivityId();
  const drag=useRef<ReviewMediaDrag|null>(null);
  useLayoutEffect(()=>{drag.current=null;},[revision]);
  useLayoutEffect(()=>{
    if(!active)return;
    const cancel=()=>{drag.current=null;};
    const unsubscribe=TaskManager.subscribe(()=>{if(!isMeituanForegroundActivity(activityId))cancel();});
    const node=dialog.current;
    let width=node?.offsetWidth,height=node?.offsetHeight;
    const observer=new ResizeObserver(()=>{
      if(node&&(node.offsetWidth!==width||node.offsetHeight!==height))cancel();
      width=node?.offsetWidth;height=node?.offsetHeight;
    });
    if(node)observer.observe(node);
    window.addEventListener('resize',cancel);window.addEventListener('blur',cancel);
    return()=>{cancel();unsubscribe();observer.disconnect();window.removeEventListener('resize',cancel);window.removeEventListener('blur',cancel);};
  },[active,activityId,dialog]);
  useLayoutEffect(()=>{
    const node=dialog.current,scope=node?.closest('.mt-root');
    if(!active||!node||!scope)return;
    const previous=document.activeElement instanceof HTMLElement&&scope.contains(document.activeElement)?document.activeElement:null;
    const saved:Array<{element:HTMLElement;inert:boolean}>=[];
    let child:Element=node;
    for(let parent=child.parentElement;parent&&scope.contains(parent);parent=child.parentElement){
      for(const sibling of parent.children)if(sibling!==child&&sibling instanceof HTMLElement){saved.push({element:sibling,inert:sibling.inert});sibling.inert=true;}
      if(parent===scope)break;child=parent;
    }
    if(isMeituanForegroundActivity(activityId))node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
    return()=>{saved.forEach(({element,inert})=>{element.inert=inert;});if(previous?.isConnected&&isMeituanForegroundActivity(activityId))previous.focus({preventScroll:true});};
  },[active,activityId,dialog]);
  useLayoutEffect(()=>{
    const node=dialog.current;
    if(active&&node&&!node.contains(document.activeElement)&&isMeituanForegroundActivity(activityId))node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
  },[active,revision,activityId,dialog]);
  useEffect(()=>{
    if(!active)return;
    const keydown=(event:KeyboardEvent)=>{
      if(!owns()||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
      if(event.key==='Escape'){event.preventDefault();onClose();}
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();onStep(event.key==='ArrowLeft'?'previous':'next');}
      if(event.key==='Tab'){
        const nodes=[...(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])].filter(el=>el.checkVisibility());
        if(!nodes.length)return;const index=nodes.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();nodes[index<0?(event.shiftKey?nodes.length-1:0):(index+(event.shiftKey?-1:1)+nodes.length)%nodes.length].focus({preventScroll:true});
      }
    };
    document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown);
  },[active,dialog,onClose,onStep,owns]);
  return {
    onDragStart:(event:React.DragEvent)=>event.preventDefault(),
    onPointerDown:(event:React.PointerEvent<HTMLDivElement>)=>{
      if(!active||!owns()||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0)||(event.target as Element).closest('button'))return;
      drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,bounds:event.currentTarget.getBoundingClientRect()};event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerUp:(event:React.PointerEvent<HTMLDivElement>)=>{
      const start=drag.current;drag.current=null;
      if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
      if(!start||start.id!==event.pointerId||!owns())return;
      const direction=reviewMediaSwipe(start,{id:event.pointerId,x:event.clientX,y:event.clientY,bounds:event.currentTarget.getBoundingClientRect()});
      if(direction)onStep(direction);
    },
    onPointerCancel:()=>{drag.current=null;},
    onLostPointerCapture:()=>{drag.current=null;},
  };
}
