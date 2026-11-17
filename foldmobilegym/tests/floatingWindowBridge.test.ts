import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getState, setFloatingWindow, setMultiWindow, setPosture } from '../foldagent';

beforeEach(() => {
  vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty: vi.fn() } } });
  vi.stubGlobal('window', { innerWidth: 1400, innerHeight: 1000, dispatchEvent: vi.fn() });
  setPosture('unfolded'); setMultiWindow('fullscreen');
});
afterEach(() => vi.unstubAllGlobals());
describe('volatile floating bridge state', () => {
  it('publishes task identity and normalized bounds without a fake second app', () => {
    setFloatingWindow('task-notes');
    expect(getState().multi_window).toMatchObject({ mode: 'floating', primary_task_id: 'task-notes', secondary_task_id: null,
      floating: { task_id: 'task-notes', minimized: false } });
  });
  it('supports minimize/restore without replacing task identity', () => {
    const current = setFloatingWindow('task-notes').multi_window.floating!;
    setFloatingWindow(current.task_id, current.bounds, true);
    expect(getState().multi_window.floating?.minimized).toBe(true);
    setFloatingWindow(current.task_id, current.bounds, false);
    expect(getState().multi_window.floating?.task_id).toBe('task-notes');
    expect(getState().multi_window.floating?.minimized).toBe(false);
  });
  it('clears floating metadata when maximizing, splitting or folding', () => {
    setFloatingWindow('a'); setMultiWindow('split', 'a', 'b');
    expect(getState().multi_window.floating).toBeUndefined();
    setFloatingWindow('a'); setPosture('folded');
    expect(getState().multi_window.mode).toBe('fullscreen');
    expect(getState().multi_window.floating).toBeUndefined();
    setFloatingWindow('a'); setMultiWindow('fullscreen');
    expect(getState().multi_window.primary_task_id).toBeNull();
  });
  it('returns defensive snapshots and refuses an empty task', () => {
    setFloatingWindow('a'); const copy = getState();
    copy.multi_window.floating!.bounds.x = 999;
    expect(getState().multi_window.floating!.bounds.x).not.toBe(999);
    expect(() => setFloatingWindow('')).toThrow('requires a task');
  });
});

describe('two-task split posture continuity', () => {
  it('retains exact task IDs, ratios and defensive snapshots through cover/inner changes', () => {
    setMultiWindow('split', 'source-task', 'second-task', 0.57);
    const original = getState().multi_window;
    for (const posture of ['folded', 'unfolded', 'folded'] as const) {
      setPosture(posture); expect(getState().multi_window).toEqual({ ...original,
        split_orientation: posture === 'folded' ? 'stacked' : 'side_by_side' });
    }
    const snapshot = getState(); snapshot.multi_window.primary_task_id = 'wrong-task';
    expect(getState().multi_window.primary_task_id).toBe('source-task');
  });
  it('allows the cover divider to update the same split without replacing its owners', () => {
    setMultiWindow('split', 'a', 'b'); setPosture('folded'); setMultiWindow('split', 'a', 'b', 0.63);
    expect(getState().multi_window).toMatchObject({mode:'split',primary_task_id:'a',secondary_task_id:'b',divider_ratio:0.63});
    setPosture('unfolded'); expect(getState().multi_window.divider_ratio).toBe(0.63);
  });
  it('does not invent cover triple windows or preserve floating metadata as a split', () => {
    setMultiWindow('triple', 'a', 'b', 0.5, 'c'); setPosture('folded');
    expect(getState().multi_window.mode).toBe('fullscreen');
    expect(() => setMultiWindow('triple', 'a', 'b', 0.5, 'c')).toThrow();
    setFloatingWindow('a'); setMultiWindow('split', 'a', 'b'); expect(getState().multi_window.floating).toBeUndefined();
  });
});
