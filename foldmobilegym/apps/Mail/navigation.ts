import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { getTracker } from '@/os/utils/memoryHistoryTracker';
import { NAVIGATION_DECLARATION } from './navigation.declaration';
import { mailSearchBackFallback } from './searchRouting';
export type MailTransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];
export function mailMessageMenuParent(pathname: string, search: string): string {
  const query = new URLSearchParams(search); query.delete('menu');
  return pathname + (query.size ? `?${query}` : '');
}
export function hasMailMessageMenuParent(pathname: string, search: string, previous?: { pathname: string; search: string }): boolean {
  if (!previous || previous.pathname !== pathname) return false;
  const query = new URLSearchParams(search); query.delete('menu'); query.sort();
  const before = new URLSearchParams(previous.search); before.sort();
  return before.toString() === query.toString();
}
export function useMailNavigate() {
  const navigate = useNavigate(), location = useLocation(), { navigator } = useContext(UNSAFE_NavigationContext);
  const go = useCallback((id: MailTransitionId, params: Record<string, string> = {}, options?: { mode?: 'push' | 'replace' }) => {
    const transition = NAVIGATION_DECLARATION.transitions.find(item => item.id === id);
    if (!transition) throw new Error(`Unknown Mail transition: ${id}`);
    const path = transition.to.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''));
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(transition.search)) if (value != null) query.set(key, value);
    if (id !== 'mail.search.open' && id !== 'mail.folder.search.open') { const value = params.q ?? new URLSearchParams(location.search).get('q'); if (value) query.set('q', value); }
    if (transition.to.startsWith('/search') || transition.to.startsWith('/reply')) {
      const originFolder = params.originFolder ?? new URLSearchParams(location.search).get('originFolder');
      if (originFolder) query.set('originFolder', originFolder);
    }
    navigate(path + (query.size ? `?${query}` : ''), { replace: (options?.mode ?? transition.mode) === 'replace' });
  }, [location.search, navigate]);
  const back = useCallback(() => {
    const tracker = getTracker(navigator as object), previous = tracker?.stack[(tracker?.index ?? 0) - 1];
    const fallback = mailSearchBackFallback(location.pathname, location.search, previous);
    if (fallback) navigate(fallback, { replace: true }); else navigate(-1);
  }, [navigate, navigator, location.pathname, location.search]);
  const replaceSearchQuery = useCallback((value: string) => {
    const query = new URLSearchParams(location.search); if (value) query.set('q', value); else query.delete('q');
    navigate('/search' + (query.size ? `?${query}` : ''), { replace: true });
  }, [location.search, navigate]);
  const closeMessageMenu = useCallback(() => {
    const target = mailMessageMenuParent(location.pathname, location.search);
    const tracker = getTracker(navigator as object), previous = tracker?.stack[(tracker?.index ?? 0) - 1];
    if (hasMailMessageMenuParent(location.pathname, location.search, previous)) navigate(-1);
    else navigate(target, { replace: true });
  }, [location.pathname, location.search, navigate, navigator]);
  return { go, back, replaceSearchQuery, closeMessageMenu };
}
