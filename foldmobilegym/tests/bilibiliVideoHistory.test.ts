import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as TimeService from '../os/TimeService';
vi.mock('../os/createAppStore', async () => {
  const { create } = await import('zustand');
  return { createAppStoreWithActions: (_id: string, initial: object, creator: any) => create((set, get) => ({ ...initial, ...creator(set, get) })), memoSelector: (input: any, compute: any) => (state: any) => compute(input(state)) };
});
import { useBilibiliStore } from '../apps/Bilibili/state';
import { formatHistoryVisit } from '../apps/Bilibili/utils/historyTime';
const initial = useBilibiliStore.getInitialState();
beforeEach(() => useBilibiliStore.setState(initial, true));
afterEach(() => vi.restoreAllMocks());
describe('local Bilibili video visits', () => {
  it('records most recent first and moves repeated visits rather than duplicating them', () => {
    const state = useBilibiliStore.getState();
    state.recordVideoVisit('a'); state.recordVideoVisit('b'); state.recordVideoVisit('a');
    expect(useBilibiliStore.getState().user.videoHistory).toEqual(['a', 'b']);
  });
  it('formats valid local simulated time and keeps invalid or old times unknown', () => {
    const timestamp = TimeService.fromLocalParts(2026, 9, 13, 15, 7).getTime();
    expect(formatHistoryVisit(timestamp, 'zh-Hans')).toBe('2026年10月13日 15:07');
    expect(formatHistoryVisit(timestamp, 'en')).toBe('2026-10-13 15:07');
    expect(formatHistoryVisit(undefined, 'en')).toBeNull();
    expect(formatHistoryVisit(Infinity, 'en')).toBeNull();
    expect(formatHistoryVisit(1e20, 'en')).toBeNull();
  });
  it('stores the simulated visit time, refreshes it on revisit and removes it with the entry', () => {
    const now = vi.spyOn(TimeService, 'now').mockReturnValue(123456);
    const state = useBilibiliStore.getState();
    state.recordVideoVisit('a');
    expect(useBilibiliStore.getState().user.videoHistorySeenAt?.a).toBe(123456);
    now.mockReturnValue(654321); state.recordVideoVisit('a');
    expect(useBilibiliStore.getState().user.videoHistorySeenAt?.a).toBe(654321);
    state.removeVideoVisit('a');
    expect(useBilibiliStore.getState().user.videoHistorySeenAt?.a).toBeUndefined();
  });
  it('does not invent timestamps for old IDs and prunes timestamps alongside the limit', () => {
    const state = useBilibiliStore.getState();
    state.updateUser({ videoHistory: ['legacy'] });
    vi.spyOn(TimeService, 'now').mockReturnValue(123456);
    state.recordVideoVisit('fresh');
    expect(useBilibiliStore.getState().user.videoHistorySeenAt?.legacy).toBeUndefined();
    for (let i=0; i<101; i++) state.recordVideoVisit(String(i));
    const user=useBilibiliStore.getState().user;
    expect(user.videoHistorySeenAt?.fresh).toBeUndefined();
    expect(Object.keys(user.videoHistorySeenAt || {})).toHaveLength(100);
  });
  it('removes only the selected local record, preserving unrelated user state', () => {
    const state = useBilibiliStore.getState();
    const name = state.user.name;
    state.recordVideoVisit('a'); state.recordVideoVisit('b'); state.removeVideoVisit('a');
    expect(useBilibiliStore.getState().user.videoHistory).toEqual(['b']);
    expect(useBilibiliStore.getState().user.name).toBe(name);
    state.removeVideoVisit('missing');
    expect(useBilibiliStore.getState().user.videoHistory).toEqual(['b']);
    state.removeVideoVisit('b');
    expect(useBilibiliStore.getState().user.videoHistory).toEqual([]);
  });
  it('ignores empty identifiers and bounds retained visits', () => {
    const state = useBilibiliStore.getState();
    state.recordVideoVisit('');
    expect(useBilibiliStore.getState().user.videoHistory).toBeUndefined();
    for (let i=0;i<110;i++) state.recordVideoVisit(String(i));
    const history = useBilibiliStore.getState().user.videoHistory!;
    expect(history).toHaveLength(100); expect(history[0]).toBe('109'); expect(history[99]).toBe('10');
  });
});
