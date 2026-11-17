/** Cold home/video entries normalize only their required finite tab dimension. */
export function normalizeBilibiliEntryRoute(path: string): string {
  const url = new URL(path, 'https://simulator.invalid');
  if (/^\/video\/[^/]+$/.test(url.pathname) && url.searchParams.has('commentPanel')) {
    if (url.searchParams.get('view') === 'fullscreen' || !['compose','thread'].includes(url.searchParams.get('commentPanel') || '')) {
      for (const key of ['commentPanel','rootId','replyId']) url.searchParams.delete(key);
    } else {
      url.searchParams.set('tab','comment');
      for (const key of ['menu','coinDialog']) url.searchParams.delete(key);
    }
    if (!url.searchParams.has('tab')) url.searchParams.set('tab','intro');
    return url.pathname + url.search + url.hash;
  }
  if (url.searchParams.has('tab')) return path;
  if (url.pathname === '/') url.searchParams.set('tab', 'recommend');
  else if (/^\/video\/[^/]+$/.test(url.pathname)) url.searchParams.set('tab', 'intro');
  else return path;
  return url.pathname + url.search + url.hash;
}
