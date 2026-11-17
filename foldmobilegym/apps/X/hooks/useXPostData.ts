import { useCallback, useEffect } from 'react';
import { useXLoadStatus } from '../data/view';
import { loadReplies, preload } from '../data/loader';

/** Volatile asset state: failed or pending data is not an empty relationship list. */
export function useXPostData(postId: string) {
  const status = useXLoadStatus();
  const retry = useCallback(() => { void Promise.all([preload(), loadReplies()]).catch(() => {}); }, []);
  useEffect(() => { if (postId) retry(); }, [postId, retry]);
  const loading = Object.values(status).some(value => value === 'idle' || value === 'loading');
  const failed = !loading && Object.values(status).some(value => value === 'error');
  return { loading, failed, ready: !loading && !failed, retry };
}
