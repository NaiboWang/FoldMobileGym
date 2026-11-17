import type { KeyboardServiceState } from './KeyboardService';

/** Raw service height may be configured while hidden; it is not occupied space. */
export function getVisibleKeyboardHeight(state: Pick<KeyboardServiceState, 'visible' | 'height'>): number {
  return state.visible ? state.height : 0;
}
