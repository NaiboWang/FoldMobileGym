import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TransitionId } from './navigation.declaration';
export function useAppNavigate() {
  const navigate = useNavigate();
  const go = useCallback((id: TransitionId, params: Record<string, string | number> = {}) => {
    const targets: Record<TransitionId, string> = { 'tasks.new.open': '/new', 'tasks.item.open': `/task/${params.id}`, 'tasks.list.open': '/' };
    navigate(targets[id], { replace: id === 'tasks.list.open' });
  }, [navigate]);
  const back = useCallback(() => navigate(-1), [navigate]);
  return { go, back };
}
