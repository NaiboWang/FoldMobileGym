import { useCallback, useEffect, useState } from 'react';
import { getVideoCommentsSync, loadVideoComments } from '../data/loader';
export function useCommentSource() {
  const [data,setData]=useState(getVideoCommentsSync),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let alive=true;setError(false);
    const cached=getVideoCommentsSync();
    if(cached){setData(cached);return;}
    void loadVideoComments().then(value=>{if(alive)setData(value);},()=>{if(alive)setError(true);});
    return()=>{alive=false;};
  },[attempt]);
  const retry=useCallback(()=>setAttempt(value=>value+1),[]);
  return {data,ready:data!==null,error,retry};
}
