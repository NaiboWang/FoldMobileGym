import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';
import { useAppNavigate } from '../navigation';
import type { TransitionId } from '../navigation.declaration';
export function useAppStoreGestures() {
  const { go } = useAppNavigate();
  const gestures = useTriggerGestures<TransitionId | 'system.back'>({
    execute: (id, params) => { if (id !== 'system.back') go(id, params); },
  });
  const bindBack = () => ({ ...gestures.bindTap('system.back'), 'data-trigger-type': 'back' as const });
  return { ...gestures, bindBack, go };
}
