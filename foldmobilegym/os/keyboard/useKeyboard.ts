import { useEffect, useState } from 'react';
import { KeyboardService, KeyboardServiceState } from './KeyboardService';
import { getVisibleKeyboardHeight } from './keyboardLayout';

/**
 * Hook to subscribe to keyboard state changes.
 * 
 * The OS already applies adjustResize to the active Activity. Do not subtract
 * keyboard height again or add keyboard-height bottom/padding offsets in apps.
 * Use this hook for visibility-dependent behavior (for example, scrolling to
 * the latest chat message), not a second viewport reduction.
 *
 *   const { visible } = useKeyboard();
 *   <div className="h-full flex flex-col">
 *     <main className="flex-1 min-h-0 overflow-y-auto">...</main>
 *     <div className="shrink-0" data-keep-keyboard="true"><input /></div>
 *   </div>
 *
 * @see ../../docs/platform/app/ui-shell.md
 */
export function useKeyboard(): KeyboardServiceState {
  const [state, setState] = useState<KeyboardServiceState>(KeyboardService.getState());

  useEffect(() => {
    return KeyboardService.subscribe(setState);
  }, []);

  return state;
}

/**
 * Returns just the keyboard height (convenience hook).
 * Returns 0 when keyboard is hidden.
 */
export function useKeyboardHeight(): number {
  return getVisibleKeyboardHeight(useKeyboard());
}
