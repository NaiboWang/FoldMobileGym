import {useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
export function useFitnessNavigate() {
  const navigate=useNavigate();
  const go=useCallback((_id:'fitness.activity.open',params:Record<string,unknown>={})=>navigate('/activity/'+encodeURIComponent(String(params.id))),[navigate]);
  const back=useCallback(()=>navigate(-1),[navigate]);
  return {go,back};
}
