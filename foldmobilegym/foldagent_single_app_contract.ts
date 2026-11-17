/** Trusted single-app task contracts; never included in agent observations. */
import { deliveredText, normalizedFact, workflowVisible } from './foldagent_workflow_contract';
import { staticSingleContract, validateStaticSingle, judgeStaticSingle, type StaticSingleContract } from './foldagent_single_app_static';
import { judgeWechatDraft, validateWechatDraftInitial, validateWechatDraftMarker, type WechatDraftContract } from './foldagent_wechat_draft_contract';

type Dict = Record<string, any>;
export type NotesAppendContract = {
  version: 1 | 2; card: 'SA01'; app: 'notes'; kind: 'notes_append';
  target_id: string; append_text: string;
};
const stable = (value: any): any => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (a: any, b: any) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const without = (item: Dict, keys: string[]) => Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)));
const accessible = (note: Dict) => !note.isPrivate && !note.locked
  && !(typeof note.trashedAt === 'number' && Number.isFinite(note.trashedAt));

export type SingleAppContract = NotesAppendContract | WechatDraftContract | StaticSingleContract;
export function singleAppContract(task: any): SingleAppContract | null {
  const current = staticSingleContract(task);
  if (current) return current;
  const c = task?.seed_contract?.single_app_v1;
  if (c === undefined) return null;
  if (c?.card === 'SA02') {
    validateWechatDraftMarker(c);
    if (!same(task.apps, ['wechat']) || task.seed_contract.workflow_v1) throw Error('Invalid single_app_v1 contract');
    return c;
  }
  if (!c || ![1, 2].includes(c.version) || c.card !== 'SA01' || c.app !== 'notes' || c.kind !== 'notes_append'
    || typeof c.target_id !== 'string' || !c.target_id || typeof c.append_text !== 'string' || !c.append_text
    || !same(task.apps, ['notes']) || task.seed_contract.workflow_v1) throw Error('Invalid single_app_v1 contract');
  return c;
}

export function validateSingleAppInitial(initial: Dict, c: SingleAppContract) {
  if (c.version === 3) return validateStaticSingle(initial, c);
  if (c.card === 'SA02') return validateWechatDraftInitial(initial, c);
  const notes = initial.apps.notes.notes;
  if (!Array.isArray(notes) || notes.some((n: Dict) => !n || typeof n.id !== 'string')
    || new Set(notes.map((n: Dict) => n.id)).size !== notes.length) throw Error('Invalid initial Notes identities');
  const target = notes.find((n: Dict) => n.id === c.target_id);
  if (!target || typeof target.content !== 'string' || typeof target.title !== 'string' || !target.title.trim()
    || notes.filter((n: Dict) => n.title === target.title && accessible(n)).length !== 1
    || target.content.includes(c.append_text) || !accessible(target) || target.hasChecklist) {
    throw Error('SA01 requires one accessible original note and an absent append');
  }
  return target;
}

export function judgeSingleApp(initial: Dict, current: Dict, c: SingleAppContract) {
  if (c.version === 3) return judgeStaticSingle(initial, current, c);
  if (c.card === 'SA02') return judgeWechatDraft(initial, current, c);
  const old = validateSingleAppInitial(initial, c), before = initial.apps.notes;
  const after = current.apps.notes, records = after.notes;
  const target = Array.isArray(records) ? records.find((n: Dict) => n?.id === c.target_id) : undefined;
  // V1 is immutable for reproducible historical outcomes. V2 preserves the
  // entire original prefix, allowing its existing final newline to supply the
  // line boundary and one optional editor-final newline. Never trim the body.
  const literal = old.content + '\n' + c.append_text;
  const expected = c.version === 1 ? literal
    : old.content + (old.content.endsWith('\n') ? '' : '\n') + c.append_text;
  const accepted = c.version === 1 ? [literal]
    : [...new Set([expected, expected + '\n', literal, literal + '\n'])];
  const checks = [{ name: 'original_note_exact_single_append', expected: { id: c.target_id, content: expected },
    actual: target ? { id: target.id, content: target.content } : null,
    passed: Boolean(target && accepted.includes(target.content) && current.runtime?.active_app_id === c.app
      && current.runtime?.app_routes?.notes?.split(/[?#]/)[0] === `/note/${encodeURIComponent(c.target_id)}`) }];
  const safety = [
    { name: 'same_note_identity_set', passed: Array.isArray(records) && records.length === before.notes.length
      && same(records.map((n: Dict) => n?.id).sort(), before.notes.map((n: Dict) => n.id).sort()) },
    { name: 'original_note_metadata_and_images', passed: Boolean(target && same(without(old, ['content', 'updatedAt']), without(target, ['content', 'updatedAt']))) },
    { name: 'other_notes_exact', passed: Array.isArray(records) && before.notes.every((n: Dict) => n.id === c.target_id || same(n, records.find((item: Dict) => item?.id === n.id))) },
    { name: 'other_notes_state', passed: same(without(before, ['notes', '_temp']), without(after, ['notes', '_temp'])) },
  ];
  const business_passed = checks.every(item => item.passed), safety_passed = safety.every(item => item.passed);
  return { passed: business_passed && safety_passed, business_passed, safety_passed, checks, safety_checks: safety };
}

export function observeSingleApp(c: SingleAppContract, state: Dict, initial: Dict) {
  if (c.version === 3) return { candidate: false, editor: false }; // Static has no transition anchors.
  if (state.runtime?.active_app_id !== c.app || state.os?.isLauncherVisible || state.os?.isRecentsVisible) return { candidate: false, editor: false };
  const pane = document.querySelector(`[data-foldagent-pane][data-app-id="${c.app}"]`);
  if (c.card === 'SA02') {
    validateWechatDraftInitial(initial, c);
    const route = state.runtime?.app_routes?.wechat?.split(/[?#]/)[0];
    const candidate = Boolean(pane && ['/', '/search', '/contacts'].includes(route)
      && [...pane.querySelectorAll<HTMLElement>('[data-trigger="chat.open"]')].some(node => {
        let params: any; try { params = JSON.parse(node.dataset.triggerParams || '{}'); } catch { return false; }
        return params.id === c.target_id && workflowVisible(node)
          && deliveredText(node).includes(normalizedFact(c.contact_name));
      }));
    const input = pane?.querySelector('[data-benchmark-field="wechat-draft"]') ?? null;
    const editor = route === `/chat/${encodeURIComponent(c.target_id)}`
      && document.activeElement === input && workflowVisible(input);
    return { candidate, editor: Boolean(editor) };
  }
  const original = validateSingleAppInitial(initial, c);
  const candidate = Boolean(pane && [...pane.querySelectorAll('button')].some(node =>
    node.innerText.split('\n')[0].trim() === original.title
      && deliveredText(node).includes(normalizedFact(original.title))));
  const route = state.runtime?.app_routes?.notes?.split(/[?#]/)[0];
  const editor = route === `/note/${encodeURIComponent(c.target_id)}`
    && Boolean(pane && workflowVisible(pane.querySelector('[data-benchmark-field="notes-content"]')));
  return { candidate: route === '/' && candidate, editor };
}
