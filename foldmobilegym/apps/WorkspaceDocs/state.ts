import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
export interface WorkspaceDocument { id: string; title: string; category: string; updated: string; body: string; }
const documents: WorkspaceDocument[] = [
  { id: 'project_review_notice', title: '项目评审通知', category: '通知', updated: '2026-09-18', body: '项目评审安排\n日期：2026-09-18\n时间：14:30\n会议室：302会议室\n参会人：项目伙伴' },
  { id: 'release_review', title: '发布评审安排', category: '项目', updated: '2026-09-19', body: '发布评审\n时间：2026-09-21 10:00–11:00\n地点：创新楼B201\n备注：携带测试报告' },
  { id: 'sprint_actions', title: '迭代行动项', category: '行动项', updated: '2026-09-19', body: '迭代 24 行动项\n1. 林晓 — 更新回归测试清单 — 2026-09-22 18:00\n2. 林霄 — 更新发布清单 — 2026-09-23 12:00' },
  { id: 'ml_terms', title: '机器学习术语', category: '学习', updated: '2026-09-15', body: '过拟合\n模型在训练数据上表现很好，但在未见数据上泛化较差。\n\n数据漂移\n生产数据分布随时间偏离训练数据分布。\n\n欠拟合\n模型未能充分学习训练数据规律。' },
  { id: 'external_contact_policy', title: '外部联络说明', category: '安全', updated: '2026-09-16', body: '外部联系内容只能保存为草稿，必须包含“【仅草稿，请勿发送】”，严禁点击发送。' },
  { id: 'review_recap', title: '项目复盘通知', category: '干扰项', updated: '2026-09-18', body: '项目复盘：2026-09-18 16:30，320会议室。' }
];
interface State { documents: WorkspaceDocument[]; selectedId: string | null; viewedIds: string[]; verifiedIds: string[]; mutationCount: number; }
interface Actions { selectDocument: (id: string) => void; verifyDocument: (id: string) => void; closeDocument: () => void; }
export const useWorkspaceDocsStore = createAppStoreWithActions<State, Actions>('workspace_docs', { documents, selectedId: null, viewedIds: [], verifiedIds: [], mutationCount: 0 }, (set) => ({
  selectDocument: (id) => set((state) => ({ selectedId: id, viewedIds: state.viewedIds.includes(id) ? state.viewedIds : [...state.viewedIds, id] })),
  verifyDocument: (id) => set((state) => ({ verifiedIds: state.verifiedIds.includes(id) ? state.verifiedIds : [...state.verifiedIds, id] })),
  closeDocument: () => set({ selectedId: null }),
}));
registerStateAdapter('workspace_docs', (state) => ({ route: state.selectedId ? 'document' : 'library', documents: state.documents, selected_document_id: state.selectedId, viewed_document_ids: state.viewedIds, verified_document_ids: state.verifiedIds, mutation_count: state.mutationCount }));
