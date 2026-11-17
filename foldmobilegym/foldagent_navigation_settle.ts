type Action = { id: string; params?: Record<string, unknown>; valid?: boolean };
type NavigationProbe = {
  read: () => { appId: string | null | undefined; path: string | null | undefined };
  nextFrame: () => Promise<void>;
  now: () => number;
};

/** A declared shop-open click must finish routing before its checkpoint. */
export async function settleShopNavigation(action: Action, probe: NavigationProbe, timeoutMs = 2000): Promise<void> {
  if (action.valid === false || action.id !== 'meituan.shop.open') return;
  const id = action.params?.id;
  if (typeof id !== 'string' || !id) return;
  const expected = `/shop/${encodeURIComponent(id)}`;
  const deadline = probe.now() + timeoutMs;
  while (true) {
    const current = probe.read();
    // App routes may include search-origin context. It does not change which
    // shop is open; compare the pathname while preserving encoded shop IDs.
    const pathname = current.path?.split(/[?#]/, 1)[0];
    if (current.appId === 'meituan_waimai' && pathname === expected) return;
    if (probe.now() >= deadline) throw Error(`Shop navigation did not settle: ${expected}`);
    await probe.nextFrame();
  }
}
