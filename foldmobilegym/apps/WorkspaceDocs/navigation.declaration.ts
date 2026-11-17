import type { NavigationDeclaration } from '../../system/Calendar/navigation.types';
export const NAVIGATION_DECLARATION = {
  app: 'workspace_docs',
  routes: [
    { path: '/', component: 'WorkspaceDocsLibrary', params: {}, entryPoint: 'home', queryParams: {}, scrollContainers: [{ name: 'documents', direction: 'vertical', description: '文档列表' }], uiStates: [{ id: 'workspace_docs.library.base', search: {}, description: '工作文档列表' }], description: '工作文档列表' },
    { path: '/document/:id', component: 'WorkspaceDocumentReader', params: { id: 'string' }, entryPoint: 'deepLink', queryParams: {}, scrollContainers: [{ name: 'document', direction: 'vertical', description: '只读文档正文' }], uiStates: [{ id: 'workspace_docs.document.base', search: {}, description: '只读文档', actions: [{ id: 'workspaceDocs.document.fact.verify', label: '阅读并核对文档事实', behavior: 'other' }] }], description: '只读文档' }
  ],
  transitions: [
    { id: 'workspace_docs.document.open', from: '/', to: '/document/:id', search: {}, searchParams: {}, params: { id: 'string' }, mode: 'push', label: '打开文档', ui: { placement: 'content', icon: 'document', gesture: 'tap' }, dataSource: { ref: 'documents', paramMapping: { id: 'id' }, labelField: 'title' } },
    { id: 'workspace_docs.library.open', from: '/document/:id', to: '/', search: {}, searchParams: {}, params: {}, mode: 'replace', label: '返回文档列表', ui: { placement: 'topbar', icon: 'back', gesture: 'tap' } }
  ],
  capabilities: { historyBack: true },
} as const satisfies NavigationDeclaration;
export type TransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];
