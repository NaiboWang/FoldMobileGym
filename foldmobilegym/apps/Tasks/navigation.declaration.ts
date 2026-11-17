import type { NavigationDeclaration } from '../../system/Calendar/navigation.types';
export const NAVIGATION_DECLARATION = {
  app: 'tasks',
  routes: [
    { path: '/', component: 'TasksList', params: {}, entryPoint: 'home', queryParams: {}, scrollContainers: [{ name: 'tasks', direction: 'vertical', description: '待办列表' }], uiStates: [{ id: 'tasks.list.base', search: {}, description: '待办列表' }], description: '待办列表' },
    { path: '/new', component: 'TaskForm', params: {}, entryPoint: 'none', queryParams: {}, scrollContainers: [{ name: 'form', direction: 'vertical', description: '新建待办表单' }], uiStates: [{ id: 'tasks.form.base', search: {}, description: '新建待办表单', actions: [
      { id: 'tasks.form.title.input', label: '输入标题', behavior: 'input', paramsSchema: { value: 'string' } },
      { id: 'tasks.form.due.input', label: '输入截止时间', behavior: 'input', paramsSchema: { value: 'string' } },
      { id: 'tasks.form.list.input', label: '选择列表', behavior: 'input', paramsSchema: { value: 'string' } },
      { id: 'tasks.form.note.input', label: '输入备注', behavior: 'input', paramsSchema: { value: 'string' } },
      { id: 'tasks.form.save', label: '保存待办', behavior: 'submit' }
    ] }], description: '新建待办表单' },
    { path: '/task/:id', component: 'TaskDetail', params: { id: 'string' }, entryPoint: 'deepLink', queryParams: {}, scrollContainers: [], uiStates: [{ id: 'tasks.detail.base', search: {}, description: '待办详情', actions: [{ id: 'tasks.detail.complete.toggle', label: '切换完成状态', behavior: 'toggle', scope: 'item', paramsSchema: { taskId: 'string' } }] }], description: '待办详情' }
  ],
  transitions: [
    { id: 'tasks.new.open', from: ['/', '/task/:id'], to: '/new', search: {}, searchParams: {}, params: {}, mode: 'push', label: '新建待办', ui: { placement: 'fab', icon: 'add', gesture: 'tap' } },
    { id: 'tasks.item.open', from: '/', to: '/task/:id', search: {}, searchParams: {}, params: { id: 'string' }, mode: 'push', label: '打开待办', ui: { placement: 'content', icon: 'task', gesture: 'tap' }, dataSource: { ref: 'items', paramMapping: { id: 'id' }, labelField: 'title' } },
    { id: 'tasks.list.open', from: ['/new', '/task/:id'], to: '/', search: {}, searchParams: {}, params: {}, mode: 'replace', label: '返回待办列表', ui: { placement: 'topbar', icon: 'back', gesture: 'tap' } }
  ],
  capabilities: { historyBack: true },
} as const satisfies NavigationDeclaration;
export type TransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];
