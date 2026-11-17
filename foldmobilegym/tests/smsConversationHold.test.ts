import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSmsConversationHold } from '../system/Sms/conversationHold';
const pointer = {pointerId: 1, clientX: 100, clientY: 100, button: 0, isPrimary: true};
describe('SMS pending conversation hold', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('opens exactly once after the retained 500ms and consumes only the resulting click', () => {
    const hold=createSmsConversationHold(),open=vi.fn();hold.start(pointer,()=>true,open);
    vi.advanceTimersByTime(499);expect(open).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(open).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);expect(open).toHaveBeenCalledTimes(1);expect(hold.consumeClick()).toBe(true);expect(hold.consumeClick()).toBe(false);
  });
  it('keeps a short primary tap available', () => {
    const hold=createSmsConversationHold(),open=vi.fn();hold.start(pointer,()=>true,open);hold.end(1);vi.advanceTimersByTime(600);
    expect(open).not.toHaveBeenCalled();expect(hold.consumeClick()).toBe(false);
  });
  it('cancels movement without converting the gesture to a tap', () => {
    const hold=createSmsConversationHold(),open=vi.fn();hold.start(pointer,()=>true,open);hold.move({...pointer,clientX:120});hold.end(1);vi.advanceTimersByTime(600);
    expect(open).not.toHaveBeenCalled();expect(hold.consumeClick()).toBe(true);
  });
  it('allows small movement but ignores a foreign pointer end or move', () => {
    const hold=createSmsConversationHold(),open=vi.fn();hold.start(pointer,()=>true,open);hold.move({...pointer,clientX:104});hold.move({...pointer,pointerId:2,clientX:999});hold.end(2);hold.cancel(2);vi.advanceTimersByTime(500);expect(open).toHaveBeenCalledTimes(1);
  });
  it.each([{button:2},{isPrimary:false},{clientX:NaN}])('does not schedule unsupported input %j', patch => {
    const hold=createSmsConversationHold(),open=vi.fn();hold.start({...pointer,...patch},()=>true,open);vi.advanceTimersByTime(600);expect(open).not.toHaveBeenCalled();
  });
  it('does not open if source, route, visibility or foreground ownership was revoked', () => {
    const hold=createSmsConversationHold(),open=vi.fn();let owned=true;hold.start(pointer,()=>owned,open);owned=false;vi.advanceTimersByTime(600);
    expect(open).not.toHaveBeenCalled();expect(hold.consumeClick()).toBe(true);
  });
  it('cancels on scroll, route change or component disposal and allows the next press', () => {
    const hold=createSmsConversationHold(),open=vi.fn();hold.start(pointer,()=>true,open);hold.cancel();vi.advanceTimersByTime(600);expect(open).not.toHaveBeenCalled();
    hold.start(pointer,()=>true,open);vi.advanceTimersByTime(500);expect(open).toHaveBeenCalledTimes(1);
  });
  it('cancels the first hold on a second finger without turning it into a tap', () => {
    const hold=createSmsConversationHold(),open=vi.fn();hold.start(pointer,()=>true,open);hold.start({...pointer,pointerId:2,isPrimary:false},()=>true,open);hold.end(1);vi.advanceTimersByTime(600);
    expect(open).not.toHaveBeenCalled();expect(hold.consumeClick()).toBe(true);
  });
  it('replaces an earlier pending press rather than leaking two timers', () => {
    const hold=createSmsConversationHold(),old=vi.fn(),next=vi.fn();hold.start(pointer,()=>true,old);hold.start({...pointer,pointerId:2},()=>true,next);vi.advanceTimersByTime(600);
    expect(old).not.toHaveBeenCalled();expect(next).toHaveBeenCalledTimes(1);
  });
});
