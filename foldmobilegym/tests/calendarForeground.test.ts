import { describe, expect, it } from 'vitest';
import type { OSState } from '../os/types';
import { isCalendarForeground } from '../system/Calendar/hooks/useCalendarForeground';

const state = (overrides: Partial<OSState> = {}): OSState => ({
  tasks: [{ taskId: 'calendar-task', rootAppId: 'calendar', lastActiveAt: 0,
    stack: [{ activityId: 'calendar-editor', appId: 'calendar', initialRoute: '/new-event' }] }],
  activeTaskId: 'calendar-task', isLauncherVisible: false, isRecentsVisible: false, ...overrides,
});

describe('Calendar editor foreground ownership', () => {
  it('accepts the actual top foreground Activity', () => {
    expect(isCalendarForeground(state(), 'calendar-editor')).toBe(true);
  });
  it('rejects an absent OS state or Activity identity', () => {
    expect(isCalendarForeground(undefined, 'calendar-editor')).toBe(false);
    expect(isCalendarForeground(state(), '')).toBe(false);
  });
  it.each([
    { isRecentsVisible: true }, { isLauncherVisible: true },
    { isLauncherVisible: true, isRecentsVisible: true },
    { activeTaskId: null }, { activeTaskId: 'other-task' }, { tasks: [] },
  ])('rejects non-foreground state without changing retained tasks: %j', overrides => {
    const snapshot = state(overrides), before = structuredClone(snapshot);
    expect(isCalendarForeground(snapshot, 'calendar-editor')).toBe(false);
    expect(snapshot).toEqual(before);
  });
  it('rejects another Activity in the same active task', () => {
    const snapshot = state();
    snapshot.tasks[0].stack.push({ activityId: 'picker', appId: 'calendar', initialRoute: '/picker' });
    expect(isCalendarForeground(snapshot, 'calendar-editor')).toBe(false);
    expect(isCalendarForeground(snapshot, 'picker')).toBe(true);
  });
  it('reacquires ownership when the exact Activity returns from Recents', () => {
    const snapshot = state({ isRecentsVisible: true });
    expect(isCalendarForeground(snapshot, 'calendar-editor')).toBe(false);
    expect(isCalendarForeground({ ...snapshot, isRecentsVisible: false }, 'calendar-editor')).toBe(true);
  });
});
