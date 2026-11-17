/** Retry bounded navigator waits while the original Activity request remains valid. */
export async function navigateWhenAvailable(
  wait: () => Promise<((path: string, options?: { replace?: boolean }) => void) | null>,
  isCurrent: () => boolean,
  route: string,
  options?: { replace?: boolean },
): Promise<boolean> {
  while (isCurrent()) {
    const navigate = await wait();
    // An Activity can be closed or superseded while its navigator is loading.
    if (!isCurrent()) return false;
    if (navigate) {
      navigate(route, options);
      return true;
    }
  }
  return false;
}
