/**
 * FileManager Gesture Hooks
 * 
 * Provides gesture bindings for navigation transitions
 */
import { useCallback } from 'react';
import { useAppNavigate } from '../navigation';
import { useTriggerGestures } from '@/os/hooks/useTriggerGestures';
import { TransitionId } from '../navigation.declaration';

type GestureProps = {
  onClick: (e: React.MouseEvent) => void;
  'data-trigger': string;
  'data-trigger-type': 'tap' | 'longPress' | 'doubleTap';
  'data-trigger-params'?: string;
};
type TransitionOptions = { params?: Record<string, string | number>; mode?: 'push' | 'replace'; beforeTrigger?: () => void };
type ActionSpec = { kind: 'action'; id: string };
type ActionOptions = { params?: Record<string, string | number | boolean>; onTrigger: () => void; beforeTrigger?: () => void; stopPropagation?: boolean };
type ActionProps = React.HTMLAttributes<HTMLElement> & { 'data-action': string; 'data-action-type': string; 'data-action-params'?: string };

export function useFileManagerGestures() {
  const { go, back } = useAppNavigate();
  const { bindTap: bindSystemTap } = useTriggerGestures<'system.back'>();

  function bindTap(transitionId: TransitionId, options?: TransitionOptions): GestureProps;
  function bindTap(action: ActionSpec, options: ActionOptions): ActionProps;
  function bindTap(id: TransitionId | ActionSpec, options?: TransitionOptions | ActionOptions): GestureProps | ActionProps {
      if (typeof id !== 'string') return bindSystemTap(id, options as ActionOptions);
      const transitionId = id, transitionOptions = options as TransitionOptions | undefined;
      return {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          transitionOptions?.beforeTrigger?.();
          go(transitionId, transitionOptions?.params || {}, { mode: transitionOptions?.mode });
        },
        'data-trigger': transitionId,
        'data-trigger-type': 'tap',
        ...(transitionOptions?.params && {
          'data-trigger-params': JSON.stringify(transitionOptions.params),
        }),
      };
  }

  const bindBack = useCallback(() => ({
    ...bindSystemTap('system.back'),
    'data-trigger': 'system.back' as const,
    'data-trigger-type': 'tap' as const,
  }), [bindSystemTap]);

  return { bindTap, bindBack, go, back };
}
