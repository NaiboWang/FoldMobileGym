import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fold, unfold, getState, setMultiWindow, setPosture, type SplitOrientation } from '../foldagent';

beforeEach(() => {
  vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty: vi.fn() } } });
  vi.stubGlobal('window', { innerWidth: 1400, innerHeight: 1000, dispatchEvent: vi.fn() });
  setPosture('unfolded'); setMultiWindow('fullscreen');
});
afterEach(() => vi.unstubAllGlobals());

describe('split orientation across cover and inner displays', () => {
  it('explicit fold/unfold APIs preserve the split and are idempotent', () => {
    setMultiWindow('split', 'calendar-task', 'wechat-task', 0.57, null, 0.5, 'side_by_side');
    const dispatch = vi.mocked(window.dispatchEvent);
    dispatch.mockClear();
    expect(fold()).toMatchObject({ posture: 'folded', active_display: 'cover',
      multi_window: { primary_task_id: 'calendar-task', secondary_task_id: 'wechat-task',
        split_orientation: 'stacked', divider_ratio: 0.57 } });
    const foldedEvents = dispatch.mock.calls.length;
    fold();
    expect(dispatch.mock.calls).toHaveLength(foldedEvents);
    expect(unfold()).toMatchObject({ posture: 'unfolded', active_display: 'inner',
      multi_window: { primary_task_id: 'calendar-task', secondary_task_id: 'wechat-task',
        split_orientation: 'side_by_side', divider_ratio: 0.57 } });
    const unfoldedEvents = dispatch.mock.calls.length;
    unfold();
    expect(dispatch.mock.calls).toHaveLength(unfoldedEvents);
  });

  it.each([undefined, 'side_by_side', 'stacked'] as const)('restores the inner orientation %s while preserving owners and ratio', orientation => {
    setMultiWindow('split', 'calendar-task', 'wechat-task', 0.57, null, 0.5, orientation);
    const preferred = orientation ?? 'side_by_side';
    for (const posture of ['folded', 'unfolded', 'folded', 'unfolded'] as const) {
      setPosture(posture);
      expect(getState().multi_window).toMatchObject({ mode: 'split', primary_task_id: 'calendar-task',
        secondary_task_id: 'wechat-task', divider_ratio: 0.57,
        split_orientation: posture === 'folded' ? 'stacked' : preferred,
        unfolded_split_orientation: preferred });
    }
  });

  it('resizing the cover split retains the inner direction and the resized ratio', () => {
    setMultiWindow('split', 'a', 'b', 0.5, null, 0.5, 'side_by_side');
    setPosture('folded');
    setMultiWindow('split', 'a', 'b', 0.61);
    expect(getState().multi_window.split_orientation).toBe('stacked');
    setPosture('unfolded');
    expect(getState().multi_window).toMatchObject({ split_orientation: 'side_by_side', divider_ratio: 0.61 });
  });

  it('restores a direction selected by rotating the inner split', () => {
    setMultiWindow('split', 'a', 'b');
    setMultiWindow('split', 'a', 'b', 0.5, null, 0.5, 'stacked');
    setPosture('folded'); setPosture('unfolded');
    expect(getState().multi_window.split_orientation).toBe('stacked');
    setMultiWindow('split', 'a', 'b', 0.5, null, 0.5, 'side_by_side');
    setPosture('folded'); setPosture('unfolded');
    expect(getState().multi_window.split_orientation).toBe('side_by_side');
  });

  it.each(['side_by_side', 'stacked'] as SplitOrientation[])('initializes on the cover using stacked layout with inner preference %s', orientation => {
    setPosture('folded');
    setMultiWindow('split', 'a', 'b', 0.5, null, 0.5, orientation);
    expect(getState().multi_window.split_orientation).toBe('stacked');
    setPosture('unfolded');
    expect(getState().multi_window.split_orientation).toBe(orientation);
  });

  it('does not inherit another pair’s direction', () => {
    setMultiWindow('split', 'a', 'b', 0.5, null, 0.5, 'stacked');
    setMultiWindow('split', 'a', 'c');
    expect(getState().multi_window.split_orientation).toBe('side_by_side');
    setMultiWindow('fullscreen');
    expect(getState().multi_window).not.toHaveProperty('unfolded_split_orientation');
  });
});
