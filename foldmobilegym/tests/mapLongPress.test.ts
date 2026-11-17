import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapLongPressGesture, mapClickClientPoint, type MapPressPoint } from '../apps/Map/utils/mapLongPress';
const point = (patch: Partial<MapPressPoint> = {}): MapPressPoint => ({ pointerId: 1, clientX: 100, clientY: 200, button: 0, isPrimary: true, ...patch });
let clock: number, gesture: MapLongPressGesture, fire: ReturnType<typeof vi.fn>;
const advance = (milliseconds: number) => { clock += milliseconds; vi.advanceTimersByTime(milliseconds); };
beforeEach(() => { vi.useFakeTimers(); clock = 0; fire = vi.fn(() => true); gesture = new MapLongPressGesture(() => clock); });
afterEach(() => { gesture.reset(); vi.useRealTimers(); });
describe('Map PointerEvent long-press lifecycle', () => {
  it('retains the existing 800 ms threshold and fires exactly once', () => {
    gesture.down(point(), fire); advance(799); expect(fire).not.toHaveBeenCalled(); advance(1); expect(fire).toHaveBeenCalledTimes(1);
    advance(2000); expect(fire).toHaveBeenCalledTimes(1);
  });
  it('keeps an ordinary short tap available and clears its pending timer', () => {
    gesture.down(point(), fire); advance(200); gesture.up(point()); advance(1000);
    expect(fire).not.toHaveBeenCalled(); expect(gesture.consumeClick(point())).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it('consumes only the click after release, never creates another pin on release', () => {
    gesture.down(point(), fire); advance(800); expect(gesture.consumeClick(point())).toBe(false);
    gesture.up(point()); expect(gesture.consumeClick(point())).toBe(true); expect(gesture.consumeClick(point())).toBe(false);
    expect(fire).toHaveBeenCalledTimes(1);
  });
  it('does not swallow the next genuine pointer gesture when the SDK emits no release click', () => {
    gesture.down(point(), fire); advance(800); gesture.up(point());
    gesture.down(point(), fire); advance(100); gesture.up(point()); expect(gesture.consumeClick(point())).toBe(false);
  });
  it.each([{ button: 2 }, { button: 1 }, { isPrimary: false }, { clientX: Number.NaN }])('does not start an ineligible pointer %o', patch => {
    gesture.down(point(patch), fire); advance(1000); expect(fire).not.toHaveBeenCalled();
  });
  it('does not schedule an unavailable/covered map surface', () => { gesture.down(point(), null); expect(vi.getTimerCount()).toBe(0); });
  it('cancels movement beyond physical screen slop and keeps SDK panning independent', () => {
    gesture.down(point(), fire); gesture.move(point({ clientX: 109 })); advance(900); expect(fire).not.toHaveBeenCalled();
  });
  it('permits small stationary jitter', () => { gesture.down(point(), fire); gesture.move(point({ clientX: 108 })); advance(800); expect(fire).toHaveBeenCalledTimes(1); });
  it('does not cancel because another noncontact pointer moves', () => {
    gesture.down(point(), fire); gesture.move(point({ pointerId: 2, clientX: 500 })); advance(800); expect(fire).toHaveBeenCalledTimes(1);
  });
  it('snapshots native prototype accessors rather than spreading a PointerEvent', () => {
    const event = Object.create(Object.fromEntries(Object.entries(point()).map(([key, value]) => [key, value]))) as MapPressPoint;
    expect(Object.keys(event)).toEqual([]); gesture.down(event, fire); gesture.move(point({ clientX: 110 })); advance(900);
    expect(fire).not.toHaveBeenCalled();
  });
  it('cancels on a second touch and does not resume merely because one finger lifts', () => {
    gesture.down(point(), fire); advance(300); gesture.down(point({ pointerId: 2, isPrimary: false }), fire);
    gesture.up(point({ pointerId: 2, isPrimary: false })); advance(900); expect(fire).not.toHaveBeenCalled();
    gesture.up(point()); gesture.down(point(), fire); advance(800); expect(fire).toHaveBeenCalledTimes(1);
  });
  it('cancels an ongoing press when another surface receives a new contact', () => {
    gesture.down(point(), fire); gesture.down(point({ pointerId: 2 }), null); advance(900); expect(fire).not.toHaveBeenCalled();
  });
  it('does not let an unrelated pointer release cancel a primary hold', () => {
    gesture.down(point(), fire); gesture.up(point({ pointerId: 99 })); advance(800); expect(fire).toHaveBeenCalledTimes(1);
  });
  it('does not create a late pin after pointercancel', () => {
    gesture.down(point(), fire); gesture.cancel(1); advance(900); expect(fire).not.toHaveBeenCalled(); expect(gesture.consumeClick(point())).toBe(false);
  });
  it('cleans timers/contact state on blur or unmount and accepts a fresh gesture', () => {
    gesture.down(point(), fire); advance(300); gesture.reset(); advance(900); expect(fire).not.toHaveBeenCalled();
    gesture.down(point(), fire); advance(800); expect(fire).toHaveBeenCalledTimes(1);
  });
  it('cancels pending camera/resize work without discarding an already completed press', () => {
    gesture.down(point(), fire); advance(800); gesture.cancelPending(); gesture.up(point()); expect(gesture.consumeClick(point())).toBe(true);
  });
  it('does not consume a click when the captured owner/handler rejects a late press', () => {
    gesture.down(point(), () => false); advance(800); gesture.up(point()); expect(gesture.consumeClick(point())).toBe(false);
  });
  it('matches the release screen position, not a lat/lng changed by sheet autopan', () => {
    gesture.down(point(), fire); advance(800); gesture.up(point({ clientX: 103, clientY: 204 }));
    expect(gesture.consumeClick(point({ clientX: 103, clientY: 204 }))).toBe(true);
  });
  it('does not consume unrelated coordinates or a keyboard-generated SDK click', () => {
    gesture.down(point(), fire); advance(800); gesture.up(point()); expect(gesture.consumeClick(null)).toBe(false);
    expect(gesture.consumeClick(point({ clientX: 500 }))).toBe(false); expect(gesture.consumeClick(point())).toBe(true);
  });
  it.each([-1, 1001])('does not retain suppression across clock reversal or expiry (%s ms)', delta => {
    gesture.down(point(), fire); advance(800); gesture.up(point()); clock += delta; expect(gesture.consumeClick(point())).toBe(false);
  });
  it('does not leak a timer or consume a click when the callback fails', () => {
    gesture.down(point(), () => { throw new Error('controlled callback failure'); }); expect(() => advance(800)).toThrow('controlled callback failure');
    expect(vi.getTimerCount()).toBe(0); gesture.up(point()); expect(gesture.consumeClick(point())).toBe(false);
  });
});
describe('Map normalized SDK click coordinates', () => {
  it('reads MouseEvent/PointerEvent screen coordinates', () => { expect(mapClickClientPoint({ clientX: 10.5, clientY: 20 })).toEqual({ clientX: 10.5, clientY: 20 }); });
  it('reads normalized touch metadata without installing a second touch event path', () => {
    expect(mapClickClientPoint({ changedTouches: [{ clientX: 10, clientY: 20 }] })).toEqual({ clientX: 10, clientY: 20 });
  });
  it.each([null, {}, { key: 'Enter' }, { clientX: Infinity, clientY: 1 }])('does not invent coordinates for %o', event => { expect(mapClickClientPoint(event)).toBeNull(); });
});
