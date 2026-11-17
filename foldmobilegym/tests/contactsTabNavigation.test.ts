import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  navigate: vi.fn(), location: { pathname: '/', search: '' },
}));
vi.mock('react', () => ({ useContext: () => ({ navigator: {} }) }));
vi.mock('react-router-dom', () => ({
  UNSAFE_NavigationContext: {},
  useLocation: () => harness.location,
  useNavigate: () => harness.navigate,
  useSearchParams: () => [new URLSearchParams(harness.location.search)],
}));
import { useAppNavigate } from '../system/Contacts/navigation';

const tabs = [
  ['tab.calls', '/'], ['tab.contacts', '/contacts'], ['tab.favorites', '/contacts?fav=true'],
] as const;

describe('Contacts visible tab navigation (real go with mocked router)', () => {
  beforeEach(() => {
    harness.navigate.mockClear();
    harness.location = { pathname: '/', search: '' };
  });

  it.each(tabs)('allows repeated selection of %s without pushing history', (id, destination) => {
    const [pathname, search = ''] = destination.split('?');
    harness.location = { pathname, search: search ? `?${search}` : '' };
    useAppNavigate().go(id);
    expect(harness.navigate.mock.calls).toEqual([[destination, { replace: true }]]);
  });

  it.each(['/contact/person-1', '/call/call-1'])('supports every visible directory tab from %s', pathname => {
    harness.location.pathname = pathname;
    for (const [id, destination] of tabs) {
      useAppNavigate().go(id);
      expect(harness.navigate).toHaveBeenLastCalledWith(destination, { replace: true });
    }
  });

  it.each([
    ['/', '?dialpad=true'],
    ['/contact/person-1', '?menu=more'],
    ['/contact/person-1', '?modal=delete'],
    ['/contact/person-1/edit', ''],
    ['/contacts/new', ''],
    ['/search', ''],
  ])('rejects hidden or blocked tabs at %s%s', (pathname, search) => {
    harness.location = { pathname, search };
    for (const [id] of tabs) expect(() => useAppNavigate().go(id)).toThrow('not allowed');
    expect(harness.navigate).not.toHaveBeenCalled();
  });
});
