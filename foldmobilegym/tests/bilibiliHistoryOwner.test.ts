import { beforeEach, describe, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({
  location: { key: 'history-entry', pathname: '/history', search: '' },
  navigator: { location: { key: 'history-entry' } },
  state: { activeTaskId: 'bili-task', isLauncherVisible: false, isRecentsVisible: false,
    tasks: [{ taskId: 'bili-task', stack: [{ activityId: 'bili-activity' }] }] },
  cleanup: undefined as undefined | (() => void),
}));
vi.mock('react', () => ({
  useContext: () => ({ navigator: harness.navigator }),
  useRef: (current: unknown) => ({ current }),
  useLayoutEffect: (effect: () => () => void) => { harness.cleanup = effect(); },
}));
vi.mock('react-router-dom', () => ({ UNSAFE_NavigationContext: {}, useLocation: () => harness.location }));
vi.mock('../os/ActivityContext', () => ({ useActivityId: () => 'bili-activity' }));
vi.mock('../os/TaskManager', () => ({ TaskManager: { getState: () => harness.state } }));
import { useBilibiliEntryOwner } from '../apps/Bilibili/hooks/useBilibiliEntryOwner';

beforeEach(() => {
  harness.navigator.location.key = 'history-entry';
  harness.state = { activeTaskId: 'bili-task', isLauncherVisible: false, isRecentsVisible: false,
    tasks: [{ taskId: 'bili-task', stack: [{ activityId: 'bili-activity' }] }] };
  harness.cleanup = undefined;
});
describe('Bilibili history entry ownership', () => {
  it('allows the actual foreground entry without changing OS state', () => {
    const before = JSON.stringify(harness.state);
    expect(useBilibiliEntryOwner()()).toBe(true);
    expect(JSON.stringify(harness.state)).toBe(before);
  });
  it('rejects a retained background callback and permits a later real return', () => {
    const owns = useBilibiliEntryOwner();
    harness.state.activeTaskId = 'clock-task'; expect(owns()).toBe(false);
    harness.state.activeTaskId = 'bili-task'; expect(owns()).toBe(true);
  });
  it.each(['isLauncherVisible', 'isRecentsVisible'] as const)('rejects callbacks while %s', field => {
    const owns = useBilibiliEntryOwner(); harness.state[field] = true;
    expect(owns()).toBe(false);
  });
  it('rejects a different top Activity even in the same task', () => {
    const owns = useBilibiliEntryOwner();
    harness.state.tasks[0].stack.push({ activityId: 'another-activity' });
    expect(owns()).toBe(false);
  });
  it('rejects an old route entry and unmounted page', () => {
    const owns = useBilibiliEntryOwner();
    harness.navigator.location.key = 'new-entry'; expect(owns()).toBe(false);
    harness.navigator.location.key = 'history-entry'; expect(owns()).toBe(true);
    harness.cleanup?.(); expect(owns()).toBe(false);
  });
  it('rejects a removed owning task', () => {
    const owns = useBilibiliEntryOwner(); harness.state.tasks = [];
    expect(owns()).toBe(false);
  });
});
