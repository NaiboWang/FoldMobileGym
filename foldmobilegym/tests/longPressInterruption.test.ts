import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ cleanup: [] as Array<() => void> }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useEffect: (effect: () => void | (() => void)) => {
  const cleanup = effect(); if (cleanup) h.cleanup.push(cleanup);
} }));
import type React from 'react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { useTriggerGestures } from '../os/hooks/useTriggerGestures';

class TestNode {
  constructor(public parent: TestNode | null = null) {}
  contains(other: unknown): boolean {
    for (let node = other; node instanceof TestNode; node = node.parent) if (node === this) return true;
    return false;
  }
}
function hub() {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  return {
    addEventListener: vi.fn((name: string, callback: (event: Event) => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(callback); }),
    removeEventListener: vi.fn((name: string, callback: (event: Event) => void) => { listeners.get(name)?.delete(callback); }),
    dispatchEvent: vi.fn((_event: Event) => true),
    fire(name: string, target: unknown) { for (const callback of [...listeners.get(name) ?? []]) callback({ type: name, target } as Event); },
    count() { return [...listeners.values()].reduce((sum, values) => sum + values.size, 0); },
  };
}
let win: ReturnType<typeof hub> & { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
let doc: ReturnType<typeof hub> & { visibilityState: string };
let enabled: boolean, execute: ReturnType<typeof vi.fn>, start: ReturnType<typeof vi.fn>, end: ReturnType<typeof vi.fn>;
type Binding = React.HTMLAttributes<HTMLElement> & { 'data-trigger': string; 'data-trigger-type': string };
let binding: Binding, makeBinding: (item: string) => Binding;
let ancestor: TestNode, item: HTMLElement;
function Probe() {
  const { bindLongPress } = useTriggerGestures<'hold'>({ execute, longPress: enabled ? { movementThreshold: 10, primaryOnly: true, cancelOnScroll: true } : undefined });
  makeBinding = item => bindLongPress<HTMLElement>('hold', { params: { item }, duration: 450, onLongPressStart: start, onLongPressEnd: end });
  binding = makeBinding('first'); return null;
}
function mount() { renderToString(createElement(Probe)); }
function pointer(patch: Record<string, unknown> = {}) {
  return { currentTarget: item, pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 30,
    preventDefault: vi.fn(), stopPropagation: vi.fn(), ...patch } as unknown as React.PointerEvent<HTMLElement>;
}
function click() { const event = pointer() as unknown as React.MouseEvent<HTMLElement>; binding.onClickCapture?.(event); return event; }
describe('opt-in long-press physical interruption policy', () => {
  beforeEach(() => {
    vi.useFakeTimers(); h.cleanup = []; enabled = true; execute = vi.fn(); start = vi.fn(); end = vi.fn();
    win = Object.assign(hub(), { setTimeout, clearTimeout }); doc = Object.assign(hub(), { visibilityState: 'visible' });
    ancestor = new TestNode(); item = new TestNode(ancestor) as unknown as HTMLElement;
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc); vi.stubGlobal('Node', TestNode);
  });
  afterEach(() => { for (const cleanup of h.cleanup) cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('retains IDs/parameters/duration and emits only one valid hold', () => {
    mount(); expect(binding['data-trigger']).toBe('hold'); expect(binding['data-trigger-type']).toBe('longPress');
    binding.onPointerDown?.(pointer()); vi.advanceTimersByTime(449); expect(execute).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(execute).toHaveBeenCalledExactlyOnceWith('hold', { item: 'first' });
    expect(win.dispatchEvent).toHaveBeenCalledTimes(1); expect(win.count() + doc.count()).toBe(0);
    expect((win.dispatchEvent.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ id: 'hold', kind: 'transition', params: { item: 'first' } });
    binding.onPointerUp?.(pointer()); expect(end).toHaveBeenCalledWith(expect.anything(), true);
    expect(click().stopPropagation).toHaveBeenCalledOnce();
  });
  it('keeps ordinary short taps available', () => {
    mount(); binding.onPointerDown?.(pointer()); vi.advanceTimersByTime(100); binding.onPointerUp?.(pointer());
    vi.advanceTimersByTime(500); expect(execute).not.toHaveBeenCalled(); expect(click().stopPropagation).not.toHaveBeenCalled();
  });
  it('accepts the exact tolerance boundary', () => {
    mount(); binding.onPointerDown?.(pointer()); binding.onPointerMove?.(pointer({ clientX: 26, clientY: 38 }));
    vi.advanceTimersByTime(450); expect(execute).toHaveBeenCalledOnce();
  });
  it('cancels movement past tolerance, cannot rearm by moving back, and suppresses release click', () => {
    mount(); binding.onPointerDown?.(pointer()); binding.onPointerMove?.(pointer({ clientX: 31 })); binding.onPointerMove?.(pointer());
    vi.advanceTimersByTime(500); binding.onPointerUp?.(pointer()); expect(execute).not.toHaveBeenCalled();
    const event = click(); expect(event.preventDefault).toHaveBeenCalledOnce(); expect(event.stopPropagation).toHaveBeenCalledOnce(); expect(win.dispatchEvent).not.toHaveBeenCalled();
  });
  it.each([{ button: 2 }, { button: 1 }, { isPrimary: false }])('ignores non-primary input %j', patch => {
    mount(); binding.onPointerDown?.(pointer(patch)); vi.advanceTimersByTime(500);
    expect(start).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled(); expect(win.count() + doc.count()).toBe(0);
  });
  it('does not let a foreign pointer move/release/cancel the active hold', () => {
    mount(); binding.onPointerDown?.(pointer());
    for (const handler of [binding.onPointerMove, binding.onPointerUp, binding.onPointerCancel, binding.onPointerLeave]) handler?.(pointer({ pointerId: 2, clientX: 99 }));
    vi.advanceTimersByTime(450); expect(execute).toHaveBeenCalledOnce();
  });
  it('does not restart an already active pointer', () => {
    mount(); binding.onPointerDown?.(pointer()); vi.advanceTimersByTime(300); binding.onPointerDown?.(pointer());
    vi.advanceTimersByTime(150); expect(execute).toHaveBeenCalledOnce(); expect(start).toHaveBeenCalledOnce();
  });
  it.each(['scroll', 'wheel'])('cancels owned %s and consumes its release click', type => {
    mount(); binding.onPointerDown?.(pointer());
    win.fire(type, type === 'scroll' ? ancestor : new TestNode(item as unknown as TestNode));
    vi.advanceTimersByTime(500); binding.onPointerUp?.(pointer()); expect(execute).not.toHaveBeenCalled();
    expect(click().stopPropagation).toHaveBeenCalledOnce(); expect(win.count() + doc.count()).toBe(0);
  });
  it('does not cancel because another pane scrolls', () => {
    mount(); binding.onPointerDown?.(pointer()); const foreign = new TestNode();
    win.fire('scroll', foreign); win.fire('wheel', foreign); vi.advanceTimersByTime(450); expect(execute).toHaveBeenCalledOnce();
  });
  it.each(['blur', 'hidden'])('cancels on page interruption: %s', type => {
    mount(); binding.onPointerDown?.(pointer());
    if (type === 'blur') win.fire('blur', win); else { doc.visibilityState = 'hidden'; doc.fire('visibilitychange', doc); }
    vi.advanceTimersByTime(500); expect(execute).not.toHaveBeenCalled(); expect(win.count() + doc.count()).toBe(0);
  });
  it('ignores a visible-page notification and detaches after success', () => {
    mount(); binding.onPointerDown?.(pointer()); doc.fire('visibilitychange', doc); vi.advanceTimersByTime(450);
    win.fire('blur', win); expect(execute).toHaveBeenCalledOnce(); expect(win.count() + doc.count()).toBe(0);
  });
  it('cleans up pending timers and temporary listeners on unmount', () => {
    mount(); binding.onPointerDown?.(pointer()); for (const cleanup of h.cleanup) cleanup(); h.cleanup = [];
    vi.advanceTimersByTime(500); expect(execute).not.toHaveBeenCalled(); expect(win.count() + doc.count()).toBe(0);
  });
  it('does not poison the next normal tap or next hold after cancellation', () => {
    mount(); binding.onPointerDown?.(pointer()); binding.onPointerMove?.(pointer({ clientX: 40 })); binding.onPointerUp?.(pointer()); click();
    binding.onPointerDown?.(pointer()); binding.onPointerUp?.(pointer()); expect(click().stopPropagation).not.toHaveBeenCalled();
    binding.onPointerDown?.(pointer()); vi.advanceTimersByTime(450); expect(execute).toHaveBeenCalledOnce();
  });
  it('recovers after focus loss even if release happened outside the browser', () => {
    mount(); binding.onPointerDown?.(pointer()); win.fire('blur', win); vi.advanceTimersByTime(500);
    binding.onPointerDown?.(pointer()); binding.onPointerUp?.(pointer()); expect(click().stopPropagation).not.toHaveBeenCalled();
    binding.onPointerDown?.(pointer()); vi.advanceTimersByTime(450); expect(execute).toHaveBeenCalledOnce();
  });
  it('accepts a new physical press after a completed hold with a lost release', () => {
    mount(); binding.onPointerDown?.(pointer()); vi.advanceTimersByTime(450);
    binding.onPointerDown?.(pointer()); binding.onPointerUp?.(pointer()); expect(click().stopPropagation).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
  });
  it('keeps independent elements independent even for the same action ID', () => {
    mount(); const second = makeBinding('second'), secondNode = new TestNode(ancestor) as unknown as HTMLElement;
    binding.onPointerDown?.(pointer()); second.onPointerDown?.(pointer({ currentTarget: secondNode, pointerId: 2 }));
    binding.onPointerMove?.(pointer({ clientX: 40 })); vi.advanceTimersByTime(450);
    expect(execute).toHaveBeenCalledExactlyOnceWith('hold', { item: 'second' });
  });
  it('retains the prior behavior for clients that have not opted in', () => {
    enabled = false; mount(); expect(binding.onPointerMove).toBeUndefined();
    binding.onPointerDown?.(pointer({ button: 2 })); expect(win.count() + doc.count()).toBe(0);
    vi.advanceTimersByTime(450); binding.onPointerUp?.(pointer({ button: 2 })); expect(execute).toHaveBeenCalledOnce();
    const event = click(); expect(event.stopPropagation).toHaveBeenCalledOnce(); expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
