import { beforeEach, describe, expect, it, vi } from 'vitest';

const adapters = vi.hoisted(() => new Map<string, (state: any) => any>());
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return {
    createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown, get: unknown) => object) =>
      createStore((set, get) => ({ ...initial, ...actions(set, get) })),
    registerStateAdapter: (id: string, adapter: (state: any) => any) => adapters.set(id, adapter),
    memoSelector: (select: (state: any) => any, derive: (value: any) => any) => (state: any) => derive(select(state)),
  };
});
import { useCalendarStore } from '../system/Calendar/state';

const initial = useCalendarStore.getState();
const snapshot = () => adapters.get('calendar')!(useCalendarStore.getState());
beforeEach(() => useCalendarStore.setState(initial, true));

describe('Calendar applied mutation identities', () => {
  it('does not count an update to a missing ID', () => {
    const before = useCalendarStore.getState();
    useCalendarStore.getState().updateEvent('missing-diagnostic', { title: 'Must not apply' });
    expect(useCalendarStore.getState()).toBe(before);
    expect(snapshot().mutation_count).toBe(initial.mutationCount);
  });
  it('does not count a deletion of a missing ID', () => {
    const before = useCalendarStore.getState();
    useCalendarStore.getState().deleteEvent('missing-diagnostic');
    expect(useCalendarStore.getState()).toBe(before);
    expect(snapshot().deleted_count).toBe(initial.deletedCount);
    expect(snapshot().mutation_count).toBe(initial.mutationCount);
  });
  it('counts a real deletion once and ignores a repeated stale deletion', () => {
    const id = initial.events[0].id;
    useCalendarStore.getState().deleteEvent(id);
    const deleted = useCalendarStore.getState();
    useCalendarStore.getState().deleteEvent(id);
    expect(useCalendarStore.getState()).toBe(deleted);
    expect(snapshot().deleted_count).toBe(initial.deletedCount + 1);
    expect(snapshot().mutation_count).toBe(initial.mutationCount + 1);
    expect(snapshot().created_count).toBe(initial.createdCount);
    expect(deleted.events).toEqual(initial.events.filter(event => event.id !== id));
    expect(deleted.draft).toBe(initial.draft);
  });
  it('updates only the specified existing event and retains its identity', () => {
    const id = initial.events[0].id;
    useCalendarStore.getState().updateEvent(id, { location: 'Diagnostic room' });
    const after = useCalendarStore.getState();
    expect(after.events[0]).toEqual({ ...initial.events[0], location: 'Diagnostic room' });
    expect(after.events.slice(1)).toEqual(initial.events.slice(1));
    expect(after.draft).toBe(initial.draft);
    expect(snapshot().mutation_count).toBe(initial.mutationCount + 1);
    expect(snapshot().created_count).toBe(initial.createdCount);
    expect(snapshot().deleted_count).toBe(initial.deletedCount);
  });
  it('does not update or count a target that has already been removed', () => {
    const id = initial.events[0].id;
    useCalendarStore.getState().deleteEvent(id);
    const before = useCalendarStore.getState();
    useCalendarStore.getState().updateEvent(id, { title: 'Stale update' });
    expect(useCalendarStore.getState()).toBe(before);
    expect(snapshot().mutation_count).toBe(initial.mutationCount + 1);
  });
  it('preserves the existing semantics of a valid same-value update', () => {
    const event = initial.events[0];
    useCalendarStore.getState().updateEvent(event.id, { title: event.title });
    expect(useCalendarStore.getState().events).toEqual(initial.events);
    expect(snapshot().mutation_count).toBe(initial.mutationCount + 1);
  });
});
