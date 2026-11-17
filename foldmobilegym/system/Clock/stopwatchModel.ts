export type StopwatchPhase = 'idle' | 'running' | 'paused';

export type StopwatchLap = {
  id: number;
  number: number;
  lapMs: number;
  totalMs: number;
};

export type StopwatchState = {
  phase: StopwatchPhase;
  elapsedMs: number;
  anchorMs: number | null;
  laps: StopwatchLap[];
  lapSequence: number;
  lapCount: number;
  runId: number;
  revision: number;
};

export const EMPTY_STOPWATCH: StopwatchState = {
  phase: 'idle', elapsedMs: 0, anchorMs: null, laps: [],
  lapSequence: 0, lapCount: 0, runId: 0, revision: 0,
};

export function observeStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.phase !== 'running' || state.anchorMs === null || !Number.isFinite(now)) return state;
  const delta = now - state.anchorMs;
  const elapsedMs = state.elapsedMs + Math.max(0, delta);
  if (now === state.anchorMs) return state;
  return { ...state, elapsedMs, anchorMs: now };
}

export function startStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (!Number.isFinite(now) || state.phase === 'running') return state;
  const observed = observeStopwatch(state, now);
  return {
    ...observed,
    phase: 'running',
    anchorMs: now,
    runId: observed.phase === 'idle' ? observed.runId + 1 : observed.runId,
    revision: observed.revision + 1,
  };
}

export function pauseStopwatch(state: StopwatchState, now: number): StopwatchState {
  const observed = observeStopwatch(state, now);
  return observed.phase === 'running'
    ? { ...observed, phase: 'paused', anchorMs: null, revision: observed.revision + 1 }
    : observed;
}

export function recordStopwatchLap(state: StopwatchState, now: number): StopwatchState {
  const observed = observeStopwatch(state, now);
  if (observed.phase === 'idle') return observed;
  const previousTotal = observed.laps[0]?.totalMs ?? 0;
  const lapSequence = observed.lapSequence + 1;
  const lapCount = observed.lapCount + 1;
  const lap = {
    id: lapSequence,
    number: lapCount,
    lapMs: observed.elapsedMs - previousTotal,
    totalMs: observed.elapsedMs,
  };
  return { ...observed, laps: [lap, ...observed.laps], lapSequence, lapCount };
}

export function resetStopwatch(state: StopwatchState): StopwatchState {
  return {
    ...EMPTY_STOPWATCH,
    lapSequence: state.lapSequence,
    runId: state.runId,
    revision: state.revision + 1,
  };
}
