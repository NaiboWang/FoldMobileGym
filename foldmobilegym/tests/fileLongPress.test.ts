import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileLongPress } from '../system/FileManager/hooks/useFileLongPress';

const pointer = { pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20 };
const setup = () => {
  vi.useFakeTimers();
  const select = vi.fn(), suppress = vi.fn();
  return { select, suppress, gesture: createFileLongPress<string>(select, suppress) };
};
afterEach(() => vi.useRealTimers());
describe('FileManager cancellable item long press', () => {
  it('selects exactly the pressed item after 500ms and suppresses its click', () => {
    const { gesture, select, suppress } = setup();
    gesture.start('a', pointer); vi.advanceTimersByTime(499); expect(select).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(select).toHaveBeenCalledExactlyOnceWith('a');
    expect(suppress).toHaveBeenLastCalledWith(true); gesture.end(pointer);
  });
  it('movement cancels the timer and suppresses a generated drag click', () => {
    const { gesture, select, suppress } = setup();
    gesture.start('a', pointer); gesture.move({ ...pointer, clientX: 40 }); vi.advanceTimersByTime(600);
    expect(select).not.toHaveBeenCalled(); expect(suppress).toHaveBeenLastCalledWith(true);
  });
  it('small stationary jitter does not cancel a legitimate long press', () => {
    const { gesture, select } = setup();
    gesture.start('a', pointer); gesture.move({ ...pointer, clientX: 23, clientY: 24 }); vi.advanceTimersByTime(500);
    expect(select).toHaveBeenCalledExactlyOnceWith('a'); gesture.dispose();
  });
  it('cancellation prevents delayed selection and a new press clears suppression', () => {
    const { gesture, select, suppress } = setup();
    gesture.start('a', pointer); gesture.cancel(pointer); vi.advanceTimersByTime(600); expect(select).not.toHaveBeenCalled();
    gesture.start('b', pointer); expect(suppress).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(500); expect(select).toHaveBeenCalledExactlyOnceWith('b'); gesture.dispose();
  });
  it('short taps and disposal cannot fire a late selection', () => {
    const { gesture, select } = setup();
    gesture.start('a', pointer); gesture.end(pointer); vi.advanceTimersByTime(600);
    gesture.start('b', pointer); gesture.dispose(); vi.advanceTimersByTime(600);
    expect(select).not.toHaveBeenCalled();
  });
  it('ignores secondary/right-button starts and foreign pointer moves/releases', () => {
    const { gesture, select } = setup();
    gesture.start('a', { ...pointer, isPrimary: false }); gesture.start('a', { ...pointer, button: 2 });
    vi.advanceTimersByTime(600); expect(select).not.toHaveBeenCalled();
    gesture.start('a', pointer); gesture.start('b', { ...pointer, pointerId: 2 });
    gesture.move({ ...pointer, pointerId: 2, clientY: 200 }); gesture.end({ pointerId: 2 }); gesture.cancel({ pointerId: 2 });
    vi.advanceTimersByTime(500); expect(select).toHaveBeenCalledExactlyOnceWith('a'); gesture.dispose();
  });
});
