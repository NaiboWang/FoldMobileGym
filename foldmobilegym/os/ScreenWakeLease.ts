export type WakeLeaseStatus='off'|'pending'|'active'|'unavailable';
/** A single foreground consumer, with owned late acquire/release and visibility cleanup. */
export function createScreenWakeLease(update:(status:WakeLeaseStatus)=>void) {
  let wanted=false,disposed=false,revision=0,sentinel:WakeLockSentinel|null=null,pending=false;
  const hidden=()=>document.visibilityState==='hidden';
  const release=()=>{const current=sentinel;sentinel=null;if(current&&!current.released)void current.release().catch(()=>{});};
  const acquire=async()=>{
    if(!wanted||disposed||pending||sentinel||hidden())return;
    if(!navigator.wakeLock){update('unavailable');return;}
    const own=revision;pending=true;update('pending');
    try{const value=await navigator.wakeLock.request('screen');
      if(disposed||!wanted||own!==revision||hidden()){await value.release();return;}
      if(value.released){update('unavailable');return;}
      sentinel=value;value.addEventListener('release',()=>{if(sentinel===value){sentinel=null;if(!disposed)update(wanted?'unavailable':'off');}});update('active');
    }catch{if(!disposed&&own===revision)update('unavailable');}
    finally{pending=false;if(!disposed&&wanted&&own!==revision)void acquire();}
  };
  const visibility=()=>{revision++;if(hidden()){release();if(!disposed)update('off');}else void acquire();};
  document.addEventListener('visibilitychange',visibility);
  return {
    setWanted(value:boolean){if(disposed)return;wanted=value;revision++;if(!value){release();update('off');}else void acquire();},
    dispose(){disposed=true;wanted=false;revision++;release();document.removeEventListener('visibilitychange',visibility);},
  };
}
