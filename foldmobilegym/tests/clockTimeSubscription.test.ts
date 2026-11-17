import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from '../os/BroadcastBus';
import { subscribeClockTime } from '../system/Clock/hooks/clockTimeSubscription';

const clock = vi.hoisted(() => ({ value: 0 }));
vi.mock('../os/TimeService', () => ({ now: () => clock.value }));
const cleanups: (() => void)[] = [];
function observe() {
  const listener = vi.fn();
  const stop = subscribeClockTime(listener);
  cleanups.push(stop);
  return { listener, stop };
}
beforeEach(() => { vi.useFakeTimers(); clock.value = 0; });
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.useRealTimers(); });

describe('Clock UI time observation', () => {
  it('captures time at subscription, including epoch zero', () => {
    const { listener } = observe();
    expect(listener.mock.calls).toEqual([[0]]);
  });
  it('polls the service, not elapsed real time or incremented local state', () => {
    const { listener } = observe();
    clock.value = 456789;
    vi.advanceTimersByTime(1000);
    expect(listener).toHaveBeenLastCalledWith(456789);
    vi.advanceTimersByTime(3000);
    expect(listener).toHaveBeenLastCalledWith(456789);
  });
  it.each([ACTION_TIME_SET, ACTION_TIME_TICK])('observes %s before the next poll', async action => {
    const { listener } = observe();
    clock.value = 123456;
    BroadcastBus.sendBroadcast({ action });
    await Promise.resolve();
    expect(listener.mock.calls).toEqual([[0], [123456]]);
  });
  it('accepts backward jumps rather than retaining the largest observed time', async () => {
    clock.value = 5000;
    const { listener } = observe();
    clock.value = -1000;
    BroadcastBus.sendBroadcast({ action: ACTION_TIME_SET });
    await Promise.resolve();
    expect(listener).toHaveBeenLastCalledWith(-1000);
  });
  it('cleanup cancels timers, receivers and an already-queued broadcast callback', async () => {
    const { listener, stop } = observe();
    BroadcastBus.sendBroadcast({ action: ACTION_TIME_SET });
    stop(); stop();
    await Promise.resolve();
    clock.value = 99;
    BroadcastBus.sendBroadcast({ action: ACTION_TIME_TICK });
    await Promise.resolve();
    vi.advanceTimersByTime(3000);
    expect(listener.mock.calls).toEqual([[0]]);
  });
  it('keeps independent Activity/subscriber cleanup isolated', async () => {
    const first = observe(), second = observe();
    first.stop(); clock.value = 22;
    BroadcastBus.sendBroadcast({ action: ACTION_TIME_SET });
    await Promise.resolve();
    expect(first.listener.mock.calls).toEqual([[0]]);
    expect(second.listener.mock.calls).toEqual([[0], [22]]);
  });
});
