import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixtures = vi.hoisted(() => ({
  now: 1000,
  push: vi.fn((input: Record<string, unknown>) => input),
  dismiss: vi.fn(),
  sound: { prime: vi.fn(async () => true), play: vi.fn(() => true), stop: vi.fn(), dispose: vi.fn() },
}));
vi.mock('../os/TimeService', () => ({ now: () => fixtures.now }));
vi.mock('../os/NotificationService', () => ({ default: { push: fixtures.push, dismiss: fixtures.dismiss } }));
vi.mock('../os/BrowserTimerSound', () => ({ createBrowserTimerSound: () => fixtures.sound }));
vi.mock('../os/locale', () => ({ getLocale: () => 'en', useLocale: () => 'en' }));
import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from '../os/BroadcastBus';
import { resetAllOsStores } from '../os/createOsStore';
import { EMPTY_COUNTDOWN } from '../system/Clock/countdownModel';
import { timerRuntime, useTimerRuntime } from '../system/Clock/timerRuntime';
const state = () => useTimerRuntime.getState();
const start = (seconds = 5) => timerRuntime.start(seconds, state().revision);
const tick = (now: number) => { fixtures.now = now; vi.advanceTimersByTime(200); };
beforeEach(() => { vi.useFakeTimers(); useTimerRuntime.setState({ ...EMPTY_COUNTDOWN }, true); fixtures.now = 1000; vi.clearAllMocks(); });
afterEach(() => { useTimerRuntime.setState({ ...EMPTY_COUNTDOWN }, true); vi.useRealTimers(); });

describe('volatile clock timer service', () => {
  it('runs outside the UI and posts exactly once, even across forward/backward jumps', () => {
    start(); tick(5999); expect(state().remainingMs).toBe(1); expect(fixtures.push).not.toHaveBeenCalled();
    tick(6000); expect(state().phase).toBe('finished'); expect(fixtures.push).toHaveBeenCalledTimes(1);
    expect(fixtures.push.mock.calls[0][0]).toMatchObject({ appId: 'clock', route: '/timer', autoCancel: false, title: 'Timer finished' });
    tick(1000); tick(999999); expect(fixtures.push).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it.each([ACTION_TIME_SET, ACTION_TIME_TICK])('observes %s before polling', async action => {
    start(); fixtures.now = 6000; BroadcastBus.sendBroadcast({ action }); await Promise.resolve();
    expect(state().phase).toBe('finished'); expect(fixtures.push).toHaveBeenCalledTimes(1);
  });
  it('keeps exact paused milliseconds and resumes against the service clock', () => {
    start(); fixtures.now = 2345; timerRuntime.pause(state().revision);
    expect(state()).toMatchObject({ phase: 'paused', remainingMs: 3655 }); expect(vi.getTimerCount()).toBe(0);
    fixtures.now = 100000; timerRuntime.resume(state().revision); expect(state().deadline).toBe(103655);
    tick(103654); expect(state().remainingMs).toBe(1); tick(103655); expect(state().phase).toBe('finished');
  });
  it('cannot pause past the deadline or publish the same completion twice', () => {
    start(); fixtures.now = 6000; timerRuntime.pause(state().revision);
    expect(state().phase).toBe('finished'); expect(fixtures.push).toHaveBeenCalledTimes(1);
    timerRuntime.pause(state().revision); expect(fixtures.push).toHaveBeenCalledTimes(1);
  });
  it('rejects duplicate and obsolete discrete commands', () => {
    const old = state().revision; start(); const run = state().runId;
    timerRuntime.start(99, old); timerRuntime.stop(old); expect(state().runId).toBe(run); expect(state().phase).toBe('running');
    const running = state().revision; timerRuntime.pause(running); timerRuntime.resume(running);
    expect(state().phase).toBe('paused');
  });
  it('restarts with a distinct notification identity and dismisses only its old notification', () => {
    start(); tick(6000); const first = state().notificationId; const total = state().totalMs;
    timerRuntime.start(total / 1000, state().revision); expect(state().notificationId).not.toBe(first);
    expect(fixtures.dismiss.mock.calls).toEqual([[first]]); expect(state().phase).toBe('running');
    tick(11000); expect(fixtures.push).toHaveBeenCalledTimes(2);
  });
  it('cleans up the owned notification, sound and receivers on the real OS reset', () => {
    start(); tick(6000); const id = state().notificationId; resetAllOsStores();
    expect(state().phase).toBe('setup'); expect(fixtures.dismiss).toHaveBeenCalledWith(id);
    expect(fixtures.sound.dispose).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    expect(BroadcastBus.hasReceivers(ACTION_TIME_SET)).toBe(false);
  });
  it('queued broadcasts cannot resurrect a reset timer', async () => {
    start(); fixtures.now = 6000; BroadcastBus.sendBroadcast({ action: ACTION_TIME_SET }); resetAllOsStores(); await Promise.resolve();
    vi.advanceTimersByTime(1000); expect(state().phase).toBe('setup'); expect(fixtures.push).not.toHaveBeenCalled();
  });
  it('a pre-reset setup command cannot regain ownership when the reset revision repeats', () => {
    const old = state().revision; start(); resetAllOsStores(); timerRuntime.start(99, old);
    expect(state().phase).toBe('setup');
  });
});
