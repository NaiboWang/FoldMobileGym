import { describe, expect, it } from 'vitest';
import {
  EMPTY_STOPWATCH, observeStopwatch, pauseStopwatch, recordStopwatchLap,
  resetStopwatch, startStopwatch,
} from '../system/Clock/stopwatchModel';

describe('stopwatch model', () => {
  it('accumulates elapsed time across pause and resume without counting the pause', () => {
    const running = startStopwatch(EMPTY_STOPWATCH, 1000);
    const paused = pauseStopwatch(running, 2250);
    expect(paused).toMatchObject({ phase: 'paused', elapsedMs: 1250, anchorMs: null });
    const resumed = startStopwatch(paused, 10000);
    expect(observeStopwatch(resumed, 10750)).toMatchObject({ phase: 'running', elapsedMs: 2000 });
  });

  it('preserves elapsed time on clock rollback and resumes from the new anchor', () => {
    const running = startStopwatch(EMPTY_STOPWATCH, 10000);
    const forward = observeStopwatch(running, 11500);
    const rollback = observeStopwatch(forward, 9000);
    expect(rollback).toMatchObject({ elapsedMs: 1500, anchorMs: 9000 });
    expect(observeStopwatch(rollback, 10000).elapsedMs).toBe(2500);
  });

  it('records current totals and lap deltas from the latest state', () => {
    let state = startStopwatch(EMPTY_STOPWATCH, 100);
    state = recordStopwatchLap(state, 600);
    state = recordStopwatchLap(state, 600);
    state = recordStopwatchLap(state, 900);
    expect(state.laps).toEqual([
      { id: 3, number: 3, lapMs: 300, totalMs: 800 },
      { id: 2, number: 2, lapMs: 0, totalMs: 500 },
      { id: 1, number: 1, lapMs: 500, totalMs: 500 },
    ]);
  });

  it('rejects laps while idle and keeps lap numbering continuous while paused', () => {
    expect(recordStopwatchLap(EMPTY_STOPWATCH, 5)).toBe(EMPTY_STOPWATCH);
    let state = startStopwatch(EMPTY_STOPWATCH, 0);
    state = recordStopwatchLap(state, 100);
    state = pauseStopwatch(state, 150);
    state = recordStopwatchLap(state, 900);
    expect(state.laps[0]).toMatchObject({ number: 2, lapMs: 50, totalMs: 150 });
  });

  it('reset clears display state but advances ownership and keeps IDs unique', () => {
    let state = startStopwatch(EMPTY_STOPWATCH, 0);
    state = recordStopwatchLap(state, 50);
    const reset = resetStopwatch(state);
    const restarted = startStopwatch(reset, 1000);
    const lap = recordStopwatchLap(restarted, 1100);
    expect(reset).toMatchObject({ phase: 'idle', elapsedMs: 0, laps: [], revision: state.revision + 1 });
    expect(lap.laps[0]).toMatchObject({ id: 2, number: 1, lapMs: 100, totalMs: 100 });
  });

  it('ignores invalid time samples without publishing an invalid elapsed value', () => {
    const running = startStopwatch(EMPTY_STOPWATCH, 100);
    expect(observeStopwatch(running, Number.NaN)).toBe(running);
  });
});
