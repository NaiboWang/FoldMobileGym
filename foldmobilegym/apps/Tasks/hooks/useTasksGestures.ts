import type React from 'react';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';
import type { TransitionId } from '../navigation.declaration';
import { useAppNavigate } from '../navigation';

type GestureId = TransitionId | 'system.back';

export function useTasksGestures() {
  const { go, back } = useAppNavigate();
  const { bindTap } = useTriggerGestures<GestureId>({
    execute: (id, params) => {
      if (id !== 'system.back') go(id, params);
    },
  });
  const bindBack = <T extends HTMLElement>(onTrigger?: () => void) => {
    const binding = bindTap<T>('system.back', {
      params: { steps: 1 },
      onTrigger,
    });
    return { ...binding, 'data-trigger-type': 'back' as const };
  };
  return { bindTap, bindBack, go, back };
}
