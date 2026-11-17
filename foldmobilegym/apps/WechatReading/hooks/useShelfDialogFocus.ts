import { useCallback, useLayoutEffect, useRef, useSyncExternalStore, type KeyboardEvent } from 'react';
import TaskManager from '../../../os/TaskManager';
import { useActivityId } from '../../../os/ActivityContext';

const focusables = (node: HTMLElement) => Array.from(node.querySelectorAll<HTMLElement>(
  'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
)).filter(item => item.checkVisibility() && !item.closest('[inert]'));

function focusInside(dialog: HTMLElement, target: HTMLElement) {
  target.focus({ preventScroll: true });
  const frame = dialog.getBoundingClientRect(), rect = target.getBoundingClientRect();
  const scale = frame.height > 0 ? dialog.clientHeight / frame.height : 1;
  if (rect.top < frame.top) dialog.scrollTop -= (frame.top - rect.top) * scale;
  else if (rect.bottom > frame.bottom) dialog.scrollTop += (rect.bottom - frame.bottom) * scale;
}

/** Only the owning foreground shelf/detail dialog may move focus; OS/app switching remains available. */
export function useShelfDialogFocus(open: boolean, pathname: string, routeKey: string, scope: 'shelf' | 'bookDetail' = 'shelf') {
  const rootRef = useRef<HTMLDivElement>(null), openerRef = useRef<HTMLElement | null>(null), wasOpen = useRef(false);
  const activityId = useActivityId();
  const subscribe = useCallback((notify: () => void) => TaskManager.subscribe(() => notify()), []);
  const foreground = useCallback(() => {
    const os = TaskManager.getState(), top = os.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return !os.isLauncherVisible && !os.isRecentsVisible && top?.activityId === activityId;
  }, [activityId]);
  const active = useSyncExternalStore(subscribe, foreground, foreground);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const inScope = scope === 'shelf' ? pathname === '/bookshelf' : /^\/book\/[^/]+$/.test(pathname);
    if (!active || !inScope || !root?.checkVisibility()) return;
    if (open) {
      const dialog = root.querySelector<HTMLElement>('[role="dialog"]');
      if (dialog && !dialog.contains(document.activeElement)) {
        const cancel = dialog.querySelector<HTMLElement>('button[data-trigger="system.back"]:not([disabled])');
        focusInside(dialog, (scope === 'bookDetail' ? focusables(dialog)[0] : cancel) ?? focusables(dialog)[0] ?? dialog);
      }
    } else if (wasOpen.current) {
      const opener = openerRef.current;
      if (opener?.isConnected && root.contains(opener) && !opener.closest('[inert]') && !opener.matches(':disabled')) opener.focus({ preventScroll: true });
      else root.querySelector<HTMLElement>(scope === 'bookDetail' ? '[data-trigger="book.modal.shelf.open"], [data-action="bookDetail.item.shelf.add.submit"]' : '[data-action="bookshelf.selectAll.toggle"], [data-trigger="search.open"]')?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [active, open, pathname, routeKey, scope]);
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active || event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
    const nodes = focusables(event.currentTarget), index = nodes.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    if (!nodes.length) { event.currentTarget.focus({ preventScroll: true }); return; }
    const next = event.shiftKey ? (index <= 0 ? nodes.length - 1 : index - 1) : (index + 1) % nodes.length;
    focusInside(event.currentTarget, nodes[next]);
  };
  return { rootRef, openerRef, trapFocus, active };
}
