import BackDispatcher from './BackDispatcher';
import TaskManager from './TaskManager';

/** Recents owns Back above hidden apps/keyboard, below visible system overlays. */
export function registerRecentsBackHandler() {
  return BackDispatcher.register('os.recents', () => {
    if (!TaskManager.getState().isRecentsVisible) return false;
    TaskManager.dismissRecents();
    return true;
  }, 750);
}
