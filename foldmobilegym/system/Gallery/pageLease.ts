import TaskManager from '../../os/TaskManager';

/** Pending work cannot regain authority by leaving and returning to the page. */
export function captureGalleryPageLease(ownsPage: () => boolean) {
  let released = false;
  let revoked = !ownsPage();
  const unsubscribe = TaskManager.subscribe(() => {
    if (!ownsPage()) revoked = true;
  });
  return {
    isCurrent: () => !released && !revoked && ownsPage(),
    release() {
      if (released) return;
      released = true;
      unsubscribe();
    },
  };
}
