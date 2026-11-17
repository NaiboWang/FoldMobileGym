export type CountdownPhase = 'setup' | 'running' | 'paused' | 'finished';
export type Countdown = {
  phase: CountdownPhase;
  totalMs: number;
  remainingMs: number;
  deadline: number | null;
  runId: number;
  revision: number;
  notificationId: string | null;
};
export const EMPTY_COUNTDOWN: Countdown = {
  phase: 'setup', totalMs: 0, remainingMs: 0, deadline: null,
  runId: 0, revision: 0, notificationId: null,
};
export function observeCountdown(state: Countdown, now: number): Countdown {
  if (state.phase !== 'running' || state.deadline === null || !Number.isFinite(now)) return state;
  const remainingMs = Math.min(state.totalMs, Math.max(0, state.deadline - now));
  if (remainingMs === 0) {
    return { ...state, phase: 'finished', remainingMs: 0, deadline: null, revision: state.revision + 1 };
  }
  return remainingMs === state.remainingMs ? state : { ...state, remainingMs };
}
export function beginCountdown(state: Countdown, seconds: number, now: number, id: number): Countdown {
  if (!['setup', 'finished'].includes(state.phase) || !Number.isFinite(seconds)
    || seconds <= 0 || seconds > 86399 || !Number.isFinite(now)) return state;
  const totalMs = Math.floor(seconds) * 1000;
  if (totalMs <= 0) return state;
  return {
    phase: 'running', totalMs, remainingMs: totalMs, deadline: now + totalMs,
    runId: id, revision: state.revision + 1, notificationId: `clock.timer.${id}`,
  };
}
export function pauseCountdown(state: Countdown, now: number): Countdown {
  const current = observeCountdown(state, now);
  return current.phase === 'running'
    ? { ...current, phase: 'paused', deadline: null, revision: current.revision + 1 } : current;
}
export function resumeCountdown(state: Countdown, now: number): Countdown {
  return state.phase === 'paused' && Number.isFinite(now) && state.remainingMs > 0
    ? { ...state, phase: 'running', deadline: now + state.remainingMs, revision: state.revision + 1 } : state;
}
