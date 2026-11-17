import type { NavigationDeclaration } from './navigation.types';

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
  { name: 'history', direction: 'vertical', description: 'Recent local calculations' },
  { name: 'scientificKeys', direction: 'vertical', description: 'Scientific keypad in short panes' },
  { name: 'historyDialog', direction: 'vertical', description: 'History confirmation text' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'calculator',
  routes: [
    {
      path: '/',
      component: 'CalculatorContent',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'calculator.home.base', search: {}, description: '计算器主页', actions: [
        { id: 'calculator.home.keypad.press', label: '数字或小数点', behavior: 'other', paramsSchema: { value: 'string' } },
        { id: 'calculator.home.operator.press', label: '运算符', behavior: 'other', paramsSchema: { value: 'string' } },
        { id: 'calculator.home.calculate.submit', label: '计算结果', behavior: 'submit' },
        { id: 'calculator.home.clear', label: '清除算式', behavior: 'other' },
        { id: 'calculator.home.sign', label: '切换正负号', behavior: 'other' },
        { id: 'calculator.home.percent', label: '百分比', behavior: 'other' },
        { id: 'calculator.expression.scientific.toggle', label: 'Scientific keyboard preference', behavior: 'toggle' },
        { id: 'calculator.expression.input', label: 'Edit the expression', behavior: 'input', paramsSchema: { value: 'string' } },
        { id: 'calculator.expression.key.press', label: 'Expression keypad', behavior: 'other', paramsSchema: { value: 'string' } },
        { id: 'calculator.expression.calculate.submit', label: 'Evaluate the expression', behavior: 'submit' },
        { id: 'calculator.expression.clear', label: 'Clear expression', behavior: 'other' },
        { id: 'calculator.expression.angle.toggle', label: 'Radians/degrees preference', behavior: 'toggle' },
        { id: 'calculator.expression.inverse.toggle', label: 'Inverse function preference', behavior: 'toggle' },
        { id: 'calculator.expression.memory.press', label: 'Memory operation', behavior: 'other', paramsSchema: { value: 'string' } },
      ] },
      { id: 'calculator.home.history', search: { history: 'open' }, description: 'Recent calculation history' },
      { id: 'calculator.home.history.edit', search: { history: 'edit' }, description: 'Select history records' },
      { id: 'calculator.home.history.clear', search: { history: 'open', dialog: 'deleteHistory' }, description: 'Confirm clearing visible history', actions: [
        { id: 'calculator.history.clear.submit', label: 'Clear displayed history', behavior: 'submit' },
      ] },
      { id: 'calculator.home.history.delete', search: { history: 'edit', dialog: 'deleteHistory' }, description: 'Confirm deleting selected history', actions: [
        { id: 'calculator.history.delete.submit', label: 'Delete selected history records', behavior: 'submit' },
      ] }],
      queryParams: { selection: 'string', targets: 'string' },
      description: '计算器主页',
    },
  ],
  transitions: [{
    id: 'calculator.home.history.open',
    from: { path: '/', search: { history: null, dialog: null } },
    to: '/', search: { history: 'open' }, searchParams: {}, params: {},
    mode: 'push', label: 'View recent calculations',
    ui: { placement: 'topbar', icon: 'history', gesture: 'tap' },
  }, {
    id: 'calculator.history.edit.open', from: { path: '/', search: { history: 'open', dialog: null } },
    to: '/', search: { history: 'edit' }, searchParams: {}, params: {}, mode: 'push',
    label: 'Select history records', ui: { placement: 'topbar', icon: 'edit', gesture: 'tap' },
  }, {
    id: 'calculator.history.selection.change', from: { path: '/', search: { history: 'edit', dialog: null } },
    to: '/', search: { history: 'edit' }, searchParams: { selection: 'string' }, params: {}, mode: 'replace',
    label: 'Change selected history records', ui: { placement: 'content', icon: 'check', gesture: 'tap' },
  }, {
    id: 'calculator.history.delete.open', from: { path: '/', search: { history: 'edit', dialog: null } },
    to: '/', search: { history: 'edit', dialog: 'deleteHistory' }, searchParams: { targets: 'string' }, params: {}, preserveParams: ['selection'], mode: 'push',
    label: 'Confirm deleting selected records', ui: { placement: 'topbar', icon: 'delete', gesture: 'tap' },
  }, {
    id: 'calculator.history.clear.open', from: { path: '/', search: { history: 'open', dialog: null } },
    to: '/', search: { history: 'open', dialog: 'deleteHistory' }, searchParams: { targets: 'string' }, params: {}, mode: 'push',
    label: 'Confirm clearing visible history', ui: { placement: 'topbar', icon: 'delete', gesture: 'tap' },
  }],
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];
