import {useCallback} from 'react';
import {useNavigate} from 'react-router-dom';
export function useVideoNavigate() {
  const navigate=useNavigate();
  const go=useCallback((_id: 'video.asset.open', params: Record<string, unknown> = {}) => {
    navigate('/player/'+encodeURIComponent(String(params.id)));
  },[navigate]);
  const back=useCallback(()=>navigate(-1),[navigate]);
  return {go,back};
}
