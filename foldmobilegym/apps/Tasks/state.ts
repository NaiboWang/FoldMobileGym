import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
export interface TaskItem { id: string; title: string; due: string; list: string; note: string; completed: boolean; }
export interface TaskDraft { title: string; due: string; list: string; note: string; }
const emptyDraft: TaskDraft = { title: '', due: '', list: '工作', note: '' };
const seededItems: TaskItem[] = [
  { id: 'seed_weekly', title: '整理周会材料', due: '2026-09-21T09:00:00+08:00', list: '工作', note: '只读种子干扰项', completed: false },
  { id: 'seed_library', title: '归还图书', due: '2026-09-20T18:00:00+08:00', list: '个人', note: '', completed: true }
];
interface State { items: TaskItem[]; draft: TaskDraft; editorOpen: boolean; selectedId: string | null; createdCount: number; deletedCount: number; }
interface Actions { beginCreate: () => void; updateDraft: (patch: Partial<TaskDraft>) => void; cancelCreate: () => void; saveDraft: () => string | null; selectTask: (id: string) => void; toggleTask: (id: string) => void; }
export const useTasksStore = createAppStoreWithActions<State, Actions>('tasks', {
  items: seededItems, draft: emptyDraft, editorOpen: false, selectedId: null, createdCount: 0, deletedCount: 0,
}, (set, get) => ({
  beginCreate: () => set({ editorOpen: true, selectedId: null, draft: { ...emptyDraft } }),
  updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  cancelCreate: () => set({ editorOpen: false, draft: { ...emptyDraft } }),
  saveDraft: () => {
    const draft = get().draft;
    const title = draft.title.trim();
    if (!title || !draft.due) return null;
    const id = `task_created_${get().createdCount + 1}`;
    const item: TaskItem = { id, title, due: `${draft.due}:00+08:00`, list: draft.list, note: draft.note.trim(), completed: false };
    set((state) => ({ items: [item, ...state.items], selectedId: id, editorOpen: false, draft: { ...emptyDraft }, createdCount: state.createdCount + 1 }));
    return id;
  },
  selectTask: (id) => set({ selectedId: id, editorOpen: false }),
  toggleTask: (id) => set((state) => ({
    items: state.items.map((item) => item.id === id ? { ...item, completed: !item.completed } : item),
  })),
}));
registerStateAdapter('tasks', (state) => ({
  route: state.editorOpen ? 'form' : state.selectedId ? 'detail' : 'list',
  items: state.items, draft: state.draft, selected_task_id: state.selectedId,
  created_count: state.createdCount, deleted_count: state.deletedCount,
}));
