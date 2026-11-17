/** Private evaluator for the CA/MW task cards. Never part of model observations. */
import { splitOrientationForPosture } from './foldagent_window_policy';
type Dict = Record<string, any>;
export type WorkflowContract = {
  version: 1;
  card: string;
  source: { app: string; selector: string; facts: string[][]; fact_selectors?: string[] };
  target: { app: string; kind: 'wechat' | 'note' | 'checklist' | 'calendar' | 'sms';
    id?: string; title?: string; prefix?: string; exact?: string; phone?: string;
    facts?: string[][]; forbidden?: string[]; items?: string[]; route: string; field: string;
    initial_text?: 'empty'; ignore_terminal_punctuation?: boolean;
    fact_matching?: 'numeric_boundaries' };
  protected_paths: string[];
  /** orientation describes the inner-display layout; the cover must be stacked. */
  window?: { orientation: 'side_by_side' | 'stacked'; close_source?: boolean; create_split?: boolean };
};
export const workflowContract = (task: any): WorkflowContract | null => {
  const contract = task?.seed_contract?.workflow_v1;
  if (!contract) return null;
  if (contract.version !== 1 || !contract.source?.selector || !contract.target?.route
    || !Array.isArray(contract.protected_paths) || task.apps?.[0] !== contract.source.app
    || task.apps?.[1] !== contract.target.app) throw Error('Invalid workflow_v1 task contract');
  return contract;
};
const path = (state: any, key: string) => key.split('.').reduce((value, part) => value?.[part], state);
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (a: any, b: any) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const without = (item: Dict, keys: string[]) => Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)));
export const normalizedFact = (value: any) => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
// Opt-in for sentence templates: keep internal punctuation, numbers and words
// significant. Legacy tasks continue to use their original exact comparison.
const exactText = (value: string, ignoreTerminal: boolean) => {
  const normalized = normalizedFact(value);
  return ignoreTerminal ? normalized.replace(/[。.!！?？;；]+$/u, '') : normalized;
};
export function workflowWindowMatches(c: WorkflowContract, state: Dict): boolean {
  if (!c.window || state.os?.isLauncherVisible || state.os?.isRecentsVisible) return false;
  const multi = state.foldable?.multi_window;
  if (multi?.mode !== 'split') return false;
  const orientation = multi.split_orientation ?? splitOrientationForPosture(state.foldable.posture, multi.unfolded_split_orientation);
  const expectedOrientation = splitOrientationForPosture(state.foldable.posture, c.window.orientation);
  const apps = [multi.primary_task_id, multi.secondary_task_id].map(id =>
    state.os?.tasks?.find((task: any) => task.taskId === id)?.rootAppId);
  return orientation === expectedOrientation && apps[0] === c.source.app && apps[1] === c.target.app;
}
export const includesWorkflowFacts = (text: string, facts: string[][] = [], numericBoundaries = false) => facts.every(alternatives =>
  alternatives.some(fact => {
    const haystack = normalizedFact(text), needle = normalizedFact(fact);
    if (!numericBoundaries) return haystack.includes(needle);
    // A correct price/quantity must not be a substring of a different number.
    // Keep order, whitespace, labels and surrounding prose unrestricted.
    let at = haystack.indexOf(needle);
    while (at >= 0 && needle.length) {
      const before = haystack.slice(0, at), after = haystack.slice(at + needle.length);
      const leftOk = !/^\d/.test(needle) || !/(?:\d|\d\.)$/.test(before);
      const rightOk = !/\d$/.test(needle) || !/^(?:\d|\.\d)/.test(after);
      if (leftOk && rightOk) return true;
      at = haystack.indexOf(needle, at + 1);
    }
    return false;
  }));
export function workflowAppContext(appId: string, app: Dict = {}) {
  const keys: Record<string, string[]> = {
    notes: ['notes', 'todos', 'folders'], wechat: ['chats', 'chatDrafts', 'sendCount'],
    calendar: ['events', 'draft'], sms: ['composeDrafts'], mail: ['messages', 'drafts', 'draft_input'],
    workspace_docs: ['documents'], browser: ['tabs', 'localPages'], map: ['localPlaces'],
    weather: ['savedCities', 'bundlesByCityId'],
  };
  return Object.fromEntries((keys[appId] ?? Object.keys(app)).map(key => [key, app[key] ?? null]));
}
export function judgeWorkflow(initial: Dict, current: Dict, c: WorkflowContract) {
  const checks: Array<{ name: string; passed: boolean }> = [];
  const safety: Array<{ name: string; passed: boolean }> = [];
  const check = (name: string, passed: boolean) => checks.push({ name, passed: Boolean(passed) });
  const safe = (name: string, passed: boolean) => safety.push({ name, passed: Boolean(passed) });
  for (const key of c.protected_paths) {
    const content = (value: any) => key === 'os.providers.contacts.contacts' && Array.isArray(value)
      ? value.map(contact => without(contact, ['lastContactedAt'])) : value;
    safe(`unchanged:${key}`, same(content(path(initial, key)), content(path(current, key))));
  }
  if (c.source.app === 'browser') {
    const before = initial.apps?.browser?.visitedUrls ?? [], after = current.apps?.browser?.visitedUrls;
    safe('browser_history_preserved', Array.isArray(after) && before.every((url: string) => after.includes(url)));
  }
  const t = c.target, before = initial.apps?.[t.app] ?? {}, after = current.apps?.[t.app] ?? {};
  let text = '', initialText = '';
  if (t.kind === 'wechat') {
    text = after.chatDrafts?.[t.id!] ?? after.drafts?.[t.id!]?.text ?? '';
    initialText = before.chatDrafts?.[t.id!] ?? before.drafts?.[t.id!]?.text ?? '';
    safe('other_chat_drafts', same(without(before.chatDrafts ?? {}, [t.id!]), without(after.chatDrafts ?? {}, [t.id!])));
    safe('no_send_or_chat_mutation', same(before.chats, after.chats) && (after.sendCount ?? after.send_count ?? 0) === (before.sendCount ?? before.send_count ?? 0));
  } else if (t.kind === 'note' || t.kind === 'checklist') {
    const oldNotes: Dict[] = before.notes ?? [], notes: Dict[] = after.notes ?? [];
    const added = notes.filter(n => !oldNotes.some(old => old.id === n.id));
    safe('no_extra_note_creation', added.length <= (t.kind === 'note' ? 1 : 0));
    const allowed = t.kind === 'checklist' ? t.id : null;
    safe('other_notes', oldNotes.every(n => n.id === allowed || same(n, notes.find(x => x.id === n.id))));
    safe('global_todos_unchanged', same(before.todos, after.todos));
    const note = t.kind === 'note' ? added.find(n => t.fact_matching === 'numeric_boundaries'
      ? normalizedFact(n.title) === normalizedFact(t.title) : n.title === t.title) : notes.find(n => n.id === t.id);
    check('one_target_object', t.kind === 'note' ? added.length === 1 && Boolean(note) : added.length === 0 && Boolean(note));
    if (t.kind === 'note') {
      check('new_note_visible_and_plain', !!note && !note.trashedAt && !note.isPrivate && !note.hasChecklist);
      text = note?.content ?? '';
    } else {
      check('target_list_identity', !!note && note.title === t.title && note.hasChecklist === true && !note.trashedAt);
      const rows: Dict[] = note?.checklist ?? [];
      const actual = rows.map(row => normalizedFact(row.text));
      const expected = (t.items ?? []).map(normalizedFact);
      check('exact_uncompleted_item_set', same([...actual].sort(), [...expected].sort())
        && new Set(actual).size === actual.length && rows.every(row => row.completed === false));
      const old = oldNotes.find(n => n.id === t.id);
      safe('list_metadata_preserved', !!old && !!note && same(without(old, ['checklist', 'updatedAt']), without(note, ['checklist', 'updatedAt'])));
    }
  } else if (t.kind === 'calendar') {
    const oldEvents: Dict[] = before.events ?? [], events: Dict[] = after.events ?? [];
    const old = oldEvents.find(e => e.id === t.id), event = events.find(e => e.id === t.id);
    text = event?.description ?? '';
    initialText = old?.description ?? old?.note ?? '';
    safe('other_events', oldEvents.length === events.length && oldEvents.every(e => e.id === t.id || same(e, events.find(x => x.id === e.id))));
    safe('event_fields_preserved', !!old && !!event && same(without(old, ['description', 'note']), without(event, ['description', 'note'])));
  } else if (t.kind === 'sms') {
    const digits = (s: string) => s.replace(/[^0-9]/g, '').replace(/^86(?=\d{11}$)/, '');
    const entries = Object.entries(after.composeDrafts ?? {}) as Array<[string, Dict]>;
    const matches = entries.filter(([, d]) => digits(d.boundPhone || d.recipient || '') === digits(t.phone!));
    check('one_correct_recipient', matches.length === 1);
    text = matches[0]?.[1].body ?? '';
    safe('other_sms_drafts', Object.entries(before.composeDrafts ?? {}).every(([key, value]) => same(value, after.composeDrafts?.[key]))
      && entries.every(([key, value]) => key in (before.composeDrafts ?? {}) || matches.some(([k]) => k === key) || !value.body));
  }
  if (t.kind !== 'checklist') {
    if (t.initial_text === 'empty') check('initial_target_empty',
      ['wechat', 'calendar'].includes(t.kind) && initialText.trim().length === 0);
    check('required_facts', includesWorkflowFacts(text, t.facts, t.fact_matching === 'numeric_boundaries'));
    check('prefix_preserved', !t.prefix || text.startsWith(t.prefix));
    check('exact_text', t.exact === undefined || exactText(text, t.ignore_terminal_punctuation === true)
      === exactText(t.exact, t.ignore_terminal_punctuation === true));
    check('no_conflicting_facts', !(t.forbidden ?? []).some(term => normalizedFact(text).includes(normalizedFact(term))));
    check('nonempty_target', text.trim().length > 0);
  }
  return { passed: checks.every(x => x.passed) && safety.every(x => x.passed),
    business_passed: checks.every(x => x.passed), safety_passed: safety.every(x => x.passed), checks, safety_checks: safety };
}

/** Test actual delivered pixels: clipped/hidden text cannot count as source evidence. */
function visibleRect(node: Element, rect: DOMRect): boolean {
  if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
  for (let parent: Element | null = node; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    if (parent.id === 'root' || /(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)) {
      const clip = parent.getBoundingClientRect();
      if (rect.left < clip.left - 2 || rect.right > clip.right + 2 || rect.top < clip.top - 2 || rect.bottom > clip.bottom + 2) return false;
    }
    if (parent.id === 'root') break; // Body is zero-height around the fixed simulator root.
  }
  const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
  return !!hit && node.contains(hit);
}
export function workflowVisible(node: Element | null): boolean {
  if (!node) return false;
  const r = node.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  // Large editor fields can extend below a scroll viewport; their visible centre
  // is handled through focus / individual text ranges, not full field bounds.
  const x = r.left + Math.min(r.width / 2, 30), y = r.top + Math.min(r.height / 2, 12);
  const hit = document.elementFromPoint(x, y);
  return !!hit && node.contains(hit);
}
export function deliveredText(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let result = '', node: Node | null;
  while ((node = walker.nextNode())) {
    const value = node.textContent ?? '';
    if (!value.trim()) continue;
    // Check each rendered text line separately; long pages accumulate facts
    // across real scroll actions instead of treating the entire DOM as visible.
    for (let i = 0; i < value.length; i++) {
      const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
      if (Array.from(range.getClientRects()).some(rect => visibleRect(node!.parentElement!, rect))) result += value[i];
    }
    result += ' ';
  }
  return normalizedFact(result);
}
export function observeWorkflow(c: WorkflowContract, state: Dict) {
  const source = document.querySelector(`[data-foldagent-pane][data-app-id="${c.source.app}"]`);
  const nodes = source ? Array.from(source.querySelectorAll(c.source.selector)) : [];
  const text = nodes.map(deliveredText).join('');
  const sourceFacts = c.source.facts.map((variants, index) => {
    const selector = c.source.fact_selectors?.[index];
    const delivered = selector && source ? Array.from(source.querySelectorAll(selector)).map(deliveredText).join('') : text;
    return variants.some(fact => delivered.includes(normalizedFact(fact)));
  });
  const target = document.querySelector(`[data-foldagent-pane][data-app-id="${c.target.app}"]`);
  const correctRoute = new RegExp(c.target.route).test(state.runtime?.app_routes?.[c.target.app] ?? '');
  const fields = target ? Array.from(target.querySelectorAll(c.target.field)) : [];
  const targetContext = correctRoute && fields.some(workflowVisible);
  const panes = Array.from(document.querySelectorAll<HTMLElement>('[data-app-id][data-foldagent-pane]'))
    .filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(node).display !== 'none'; });
  const split = workflowWindowMatches(c, state)
    && [c.source.app, c.target.app].every(id => panes.some(node => node.dataset.appId === id && ['primary', 'secondary'].includes(node.dataset.foldagentPane!)));
  return { sourceFacts, targetContext, split };
}
