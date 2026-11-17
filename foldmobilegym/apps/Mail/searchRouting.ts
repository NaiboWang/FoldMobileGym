import { mailFolderParent } from './folders';
export type MailSearchRoute = { kind: 'inbox' | 'search' | 'message' | 'draft'; id?: string; malformed?: boolean };
export function mailReplyId(pathname: string): string | null {
  const match = /^\/reply\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}
export function mailSearchRoute(pathname: string): MailSearchRoute {
  if (pathname === '/search') return { kind: 'search' };
  const match = /^\/search\/(message|draft)\/([^/]+)$/.exec(pathname);
  if (!match) return { kind: 'inbox' };
  try { return { kind: match[1] as 'message' | 'draft', id: decodeURIComponent(match[2]) }; }
  catch { return { kind: match[1] as 'message' | 'draft', malformed: true }; }
}
export function mailSearchBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }): string | null {
  if (new URLSearchParams(search).get('drawer') === 'open') return previous?.pathname === pathname && new URLSearchParams(previous.search).get('drawer') !== 'open' ? null : pathname;
  if (pathname.startsWith('/folder/')) return previous?.pathname === '/' && !new URLSearchParams(previous.search).has('drawer') ? null : '/';
  const reply = /^\/reply\/([^/]+)$/.exec(pathname);
  if (reply) {
    const params = new URLSearchParams(search), query = new URLSearchParams();
    const fromSearch = params.get('origin') === 'search';
    const fromDraftSearch = params.get('origin') === 'draftSearch';
    if (params.get('q')) query.set('q', params.get('q')!);
    if (params.get('originFolder')) query.set('originFolder', params.get('originFolder')!);
    const parent = fromSearch ? `/search/message/${reply[1]}` + (query.size ? `?${query}` : '')
      : fromDraftSearch ? '/search' + (query.size ? `?${query}` : '')
      : ['folder', 'folderDrafts'].includes(params.get('origin') ?? '') ? mailFolderParent(params.get('originFolder')) : '/';
    const priorQuery = new URLSearchParams(previous?.search); priorQuery.sort(); query.sort();
    return previous?.pathname === parent.split('?')[0] && (!(fromSearch || fromDraftSearch) || priorQuery.toString() === query.toString()) ? null : parent;
  }
  const route = mailSearchRoute(pathname);
  if (route.kind === 'inbox') return null;
  const parentParams = new URLSearchParams(search); if (parentParams.get('q') === '') parentParams.delete('q');
  const parentSearch = parentParams.size ? `?${parentParams}` : '';
  const parent = route.kind === 'search' ? mailFolderParent(parentParams.get('originFolder')) : '/search' + parentSearch;
  const normalized = (value: string) => { const params = new URLSearchParams(value); if (params.get('q') === '') params.delete('q'); params.sort(); return params.toString(); };
  const warm = route.kind === 'search' ? previous?.pathname === parent : previous?.pathname === '/search' && normalized(previous.search) === normalized(search);
  return warm ? null : parent;
}
