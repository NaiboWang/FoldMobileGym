import {useMeituanInteractionOwner} from './useMeituanInteractionOwner';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';

/** Action bindings for the existing single-component Meituan UI. */
export function useMeituanGestures() {
  const gestures = useTriggerGestures();
  const owns = useMeituanInteractionOwner();
  const bindBack = () => {
    const binding = gestures.bindTap('system.back');
    return { ...binding, 'data-trigger-type': 'back' as const,
      onClick: (event: React.MouseEvent<HTMLElement>) => { if (owns()) binding.onClick?.(event); },
    };
  };
  return { ...gestures, bindBack };
}
