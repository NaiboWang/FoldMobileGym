import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({ now: 1000 }));
vi.mock('../os/TimeService', () => ({ now: () => fixtures.now }));

import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from '../os/BroadcastBus';
import { resetAllOsStores } from '../os/createOsStore';
import { stopwatchRuntime, useStopwatchRuntime } from '../system/Clock/stopwatchRuntime';
import { EMPTY_STOPWATCH } from '../system/Clock/stopwatchModel';

const state = () => useStopwatchRuntime.getState();
const start = () => stopwatchRuntime.start(state().revision);
const tick = (now: number) => { fixtures.now = now; vi.advanceTimersByTime(30); };

beforeEach(() => {
  vi.useFakeTimers();
  resetAllOsStores();
  fixtures.now = 1000;
});

afterEach(() => {
  resetAllOsStores();
  vi.useRealTimers();
});

describe('volatile Clock stopwatch service', () => {
  it('continues observing after UI teardown and preserves the live run state', () => {
    start(); tick(2500);
    expect(state()).toMatchObject({ phase: 'running', elapsedMs: 1500 });
    tick(6000);
    expect(state()).toMatchObject({ phase: 'running', elapsedMs: 5000 });
  });

  it('keeps elapsed monotonic across simulated clock rollback', () => {
    start(); tick(2500); tick(900);
    expect(state()).toMatchObject({ elapsedMs: 1500, anchorMs: 900 });
    tick(1200);
    expect(state().elapsedMs).toBe(1800);
  });

  it.each([ACTION_TIME_SET, ACTION_TIME_TICK])('observes %s immediately', async action => {
    start(); fixtures.now = 1750;
    BroadcastBus.sendBroadcast({ action });
    await Promise.resolve();
    expect(state().elapsedMs).toBe(750);
  });

  it('uses current service state for same-frame laps and rejects stale controls', () => {
    start(); const runningRevision = state().revision;
    fixtures.now = 1250; stopwatchRuntime.lap(runningRevision);
    stopwatchRuntime.lap(runningRevision);
    expect(state().laps.map(lap => lap.id)).toEqual([2, 1]);
    const currentRevision = state().revision;
    stopwatchRuntime.pause(currentRevision);
    stopwatchRuntime.reset(currentRevision);
    expect(state().phase).toBe('paused');
    stopwatchRuntime.reset(state().revision);
    expect(state()).toMatchObject({ phase: 'idle', elapsedMs: 0, laps: [] });
    stopwatchRuntime.start(currentRevision);
    expect(state().phase).toBe('idle');
  });

  it('stops polling after pause and clears the run on simulated OS reset', () => {
    start(); stopwatchRuntime.pause(state().revision);
    expect(vi.getTimerCount()).toBe(0);
    stopwatchRuntime.start(state().revision);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    resetAllOsStores();
    expect(state()).toMatchObject({ phase: 'idle', elapsedMs: 0, laps: [] });
    expect(vi.getTimerCount()).toBe(0);
  });
});
