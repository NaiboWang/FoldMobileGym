/** Decode a single URL segment once; never treat a nested page as a peer ID. */
export function headerRouteIdentity(pathname: string, kind: 'chat' | 'user-profile' | 'friend-settings', suffix: '' | 'info' = ''): string | null {
  const match = new RegExp(`^/${kind}/([^/]+)${suffix ? '/info' : ''}$`).exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]) || null; }
  catch { return null; }
}
