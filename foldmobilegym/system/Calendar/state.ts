import { formatCalendarStateTime } from './eventRange';
import { createAppStoreWithActions, memoSelector, registerStateAdapter } from '../../os/createAppStore';
import { CALENDAR_CONFIG } from './data';
import * as TimeService from '@/os/TimeService';
import type { CalendarEvent, CalendarSettings, CalendarTodo } from './types';

import { createTodo, updateTodo, toggleTodo, deleteTodo, type TodoInput } from './todos';

// ---- Helper functions ----

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${TimeService.now().toString(36).slice(-4)}`;
}

function startOfDayTs(ts: number): number {
  const d = TimeService.fromTimestamp(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---- Types ----

interface CalendarState {
  todos: CalendarTodo[] | undefined;
  settings: CalendarSettings;
  events: CalendarEvent[];
  selectedDateTs: number;
  createdCount: number;
  deletedCount: number;
  mutationCount: number;
  draft: {
    title: string; notes: string; location: string;
    eventId?: string | null;
    eventType?: CalendarEvent['type'];
    startTs?: number; endTs?: number;
    startTimeInput?: string; endTimeInput?: string;
    allDay?: boolean; alarmEnabled?: boolean;
    reminderMinutesBefore?: number | null;
  };
}

interface CalendarActions {
  createTodo: (input: TodoInput) => string | null;
  updateTodo: (id: string, revision: number, input: TodoInput) => boolean;
  toggleTodo: (id: string, revision: number) => boolean;
  deleteTodo: (id: string, revision: number) => boolean;
  updateSettings: (patch: Partial<CalendarSettings>) => void;
  setSelectedDate: (date: Date) => void;
  createEvent: (event: Omit<CalendarEvent, 'id'>) => string;
  updateEvent: (id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => void;
  deleteEvent: (id: string) => void;
  updateDraft: (patch: Partial<CalendarState['draft']>) => void;
  clearDraft: () => void;
}

// ---- Store ----

const benchmarkEvents: CalendarEvent[] = [
  { id: 'fold_eval_weekly', type: 'event', title: '周会—折叠屏评测', description: '', location: '创新楼A305', allDay: false, startTs: TimeService.fromLocalParts(2026, 8, 25, 9, 30).getTime(), endTs: TimeService.fromLocalParts(2026, 8, 25, 10, 30).getTime() },
  { id: 'equipment_acceptance', type: 'event', title: '设备验收', description: '从南门进入', location: '科创路88号A座5层', allDay: false, startTs: TimeService.fromLocalParts(2026, 8, 24, 15, 0).getTime(), endTs: TimeService.fromLocalParts(2026, 8, 24, 16, 30).getTime() },
];

const initialState: CalendarState = {
  todos: undefined, // Old snapshots remain empty; reset explicitly clears any newly created todos.
  settings: CALENDAR_CONFIG.settings,
  events: benchmarkEvents,
  selectedDateTs: startOfDayTs(TimeService.now()),
  createdCount: 0,
  deletedCount: 0,
  mutationCount: 0,
  draft: { title: '', notes: '', location: '' },
};

export const useCalendarStore = createAppStoreWithActions<CalendarState, CalendarActions>(
  'calendar',
  initialState,
  (set, get) => ({
    createTodo: input => {
      let created: string | null = null;
      set(state => {
        const result = createTodo(state.todos ?? [], input, TimeService.now(), randomId('todo'));
        if (!result) return state;
        created = result.id; return { todos: result.todos };
      });
      return created;
    },
    updateTodo: (id, revision, input) => {
      let changed = false;
      set(state => { const todos = updateTodo(state.todos ?? [], id, revision, input, TimeService.now());
        if (!todos) return state; changed = true; return { todos }; });
      return changed;
    },
    toggleTodo: (id, revision) => {
      let changed = false;
      set(state => { const todos = toggleTodo(state.todos ?? [], id, revision, TimeService.now());
        if (!todos) return state; changed = true; return { todos }; });
      return changed;
    },
    deleteTodo: (id, revision) => {
      let changed = false;
      set(state => { const todos = deleteTodo(state.todos ?? [], id, revision);
        if (!todos) return state; changed = true; return { todos }; });
      return changed;
    },
    updateSettings: (patch: Partial<CalendarSettings>) => {
      set(state => ({ settings: { ...state.settings, ...patch } }));
    },

    setSelectedDate: (date: Date) => {
      set({ selectedDateTs: startOfDayTs(date.getTime()) });
    },

    createEvent: (event: Omit<CalendarEvent, 'id'>) => {
      let id = randomId('evt');
      const created: CalendarEvent = { ...event, id };
      set(state => {
        const occupied = new Set(state.events.map(item => item.id));
        const candidate = id;
        let suffix = 1;
        while (occupied.has(id)) id = `${candidate}-${suffix++}`;
        created.id = id;
        return { events: [created, ...state.events], createdCount: state.createdCount + 1, mutationCount: state.mutationCount + 1 };
      });
      return id;
    },

    updateEvent: (id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => {
      set(state => {
        if (!state.events.some(event => event.id === id)) return state;
        return {
          events: state.events.map(e => (e.id === id ? { ...e, ...patch, id: e.id } : e)),
          mutationCount: state.mutationCount + 1,
        };
      });
    },

    deleteEvent: (id: string) => {
      set(state => {
        if (!state.events.some(event => event.id === id)) return state;
        return { events: state.events.filter(e => e.id !== id), deletedCount: state.deletedCount + 1, mutationCount: state.mutationCount + 1 };
      });
    },
    updateDraft: (patch) => {
      set(state => ({ draft: { ...state.draft, ...patch } }));
    },
    clearDraft: () => {
      set({ draft: { title: '', notes: '', location: '' } });
    },
  }),
);

registerStateAdapter('calendar', (state: CalendarState & CalendarActions) => ({
  ...state,
  events: state.events.map(event => ({ ...event, start: formatCalendarStateTime(event.startTs), end: formatCalendarStateTime(event.endTs), note: event.description ?? '' })),
  created_count: state.createdCount,
  deleted_count: state.deletedCount,
  mutation_count: state.mutationCount,
}));

// ---- Memoized Selectors ----

type CalendarStore = CalendarState & CalendarActions;

export const selectSelectedDate = memoSelector(
  (s: CalendarStore) => s.selectedDateTs,
  (ts: number) => TimeService.fromTimestamp(ts),
);
