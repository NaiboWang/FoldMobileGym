import { describe, expect, it } from 'vitest';
import { EMPTY_COUNTDOWN, beginCountdown, observeCountdown, pauseCountdown, resumeCountdown } from '../system/Clock/countdownModel';

const start = () => beginCountdown({ ...EMPTY_COUNTDOWN }, 5, 1000, 1);
describe('countdown deadline model', () => {
  it('retains real fractional milliseconds until the exact deadline', () => {
    const running = start();
    expect(observeCountdown(running, 5999).remainingMs).toBe(1);
    const due = observeCountdown(running, 6000);
    expect(due).toMatchObject({ phase: 'finished', remainingMs: 0, deadline: null });
    expect(observeCountdown(due, 1000)).toBe(due);
    expect(observeCountdown(due, 999999)).toBe(due);
    expect(running).toMatchObject({ phase: 'running', remainingMs: 5000 });
  });
  it('pauses a fraction and resumes relative to the new service timestamp', () => {
    const paused = pauseCountdown(start(), 2345);
    expect(paused).toMatchObject({ phase: 'paused', remainingMs: 3655, deadline: null });
    expect(observeCountdown(paused, 999999)).toBe(paused);
    const resumed = resumeCountdown(paused, 100000);
    expect(resumed.deadline).toBe(103655);
    expect(observeCountdown(resumed, 103654).remainingMs).toBe(1);
    expect(observeCountdown(resumed, 103655).phase).toBe('finished');
  });
  it('latches completion if Pause races with expiry instead of reviving it', () => {
    const result = pauseCountdown(start(), 6000);
    expect(result.phase).toBe('finished');
    expect(resumeCountdown(result, 7000)).toBe(result);
  });
  it('bounds backward jumps to the configured total', () => {
    expect(observeCountdown(start(), -100000).remainingMs).toBe(5000);
    expect(observeCountdown(start(), 4000).remainingMs).toBe(2000);
  });
  it('rejects invalid durations and nonfinite clock readings', () => {
    for (const seconds of [0, -1, NaN, Infinity, 86400, 0.9]) {
      expect(beginCountdown(EMPTY_COUNTDOWN, seconds, 0, 1)).toBe(EMPTY_COUNTDOWN);
    }
    expect(beginCountdown(EMPTY_COUNTDOWN, 2, NaN, 1)).toBe(EMPTY_COUNTDOWN);
    const running = start();
    expect(observeCountdown(running, NaN)).toBe(running);
    expect(beginCountdown(running, 3, 0, 2)).toBe(running);
  });
  it('changes discrete revision only for transitions, not countdown observations', () => {
    const running = start();
    expect(observeCountdown(running, 2000).revision).toBe(running.revision);
    const paused = pauseCountdown(running, 2000);
    expect(paused.revision).toBe(running.revision + 1);
    expect(pauseCountdown(paused, 2001)).toBe(paused);
    expect(resumeCountdown(paused, 2000).revision).toBe(paused.revision + 1);
  });
});
