import type { NavigationDeclaration } from './navigation.types';
/** Research-only dynamic form. Question/schema/answers stay owned by the existing task/runtime contract. */
export const NAVIGATION_DECLARATION = {
  app: 'answer_sheet',
  routes: [{
    path: '/', component: 'SheetPage', params: {}, entryPoint: 'home',
    scrollContainers: [{ name: 'question', direction: 'vertical', description: 'Assigned question and hint' }, { name: 'sheet-form', direction: 'vertical', description: 'Research question answer fields' }],
    uiStates: [{ id: 'answerSheet.form.base', search: {}, description: 'Assigned answer form or honest empty state', actions: [
      { id: 'answerSheet.choice.item.choose', label: 'Choose one assigned option', scope: 'item', behavior: 'other', paramsSchema: { fieldIndex: 'number', value: 'string' } },
      { id: 'answerSheet.field.item.input', label: 'Enter an assigned scalar answer', scope: 'item', behavior: 'input', paramsSchema: { fieldIndex: 'number', value: 'string' } },
      { id: 'answerSheet.repeatable.item.add', label: 'Add one repeatable answer row', scope: 'item', behavior: 'other', paramsSchema: { fieldIndex: 'number' } },
      { id: 'answerSheet.repeatable.item.remove', label: 'Remove this answer row', scope: 'item', behavior: 'other', paramsSchema: { fieldIndex: 'number', itemIndex: 'number' } },
      { id: 'answerSheet.repeatable.item.input', label: 'Enter this repeatable answer', scope: 'item', behavior: 'input', paramsSchema: { fieldIndex: 'number', itemIndex: 'number', value: 'string' } },
      { id: 'answerSheet.form.submit', label: 'Submit the authored answer as-is', behavior: 'submit' },
      { id: 'answerSheet.form.modify', label: 'Reopen authored answers for modification', behavior: 'other' },
    ] }],
    queryParams: {}, description: 'Research-only answer sheet; not a Magic V5 native application',
  }],
  transitions: [],
  capabilities: { historyBack: true },
} as const satisfies NavigationDeclaration;
