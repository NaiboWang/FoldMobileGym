/** Cold QR routes return to their own detail; warm routes pop only their exact parent. */
export function contactQrBackFallback(pathname: string, search: string,
  previous?: { pathname: string; search: string }): string | null {
  const query = new URLSearchParams(search);
  if (!/^\/contact\/[^/]+$/.test(pathname) || query.get('modal') !== 'qr' || query.has('menu')) return null;
  query.delete('modal');
  const expected = new URLSearchParams(query); expected.sort();
  const before = new URLSearchParams(previous?.search); before.sort();
  if (previous?.pathname === pathname && before.toString() === expected.toString()) return null;
  return pathname + (query.size ? `?${query}` : '');
}
