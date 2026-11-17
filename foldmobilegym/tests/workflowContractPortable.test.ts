import { describe, expect, it } from 'vitest';
import { judgeWorkflow, workflowContract, workflowWindowMatches, type WorkflowContract } from '../foldagent_workflow_contract';

// Small synthetic unit fixtures. No generated benchmark package or private gold
// files are required to run these tests in a fresh repository checkout.
function fixture(kind: WorkflowContract['target']['kind']) {
  const app = { wechat: 'wechat', note: 'notes', checklist: 'notes', calendar: 'calendar', sms: 'sms' }[kind];
  const contract: WorkflowContract = {
    version: 1, card: 'unit-fixture',
    source: { app: 'source', selector: '[data-source]', facts: [['Alpha']] },
    target: { app, kind, id: 'target', title: 'New record', route: '^/', field: 'input',
      facts: [['Alpha'], ['Room 7']], items: ['Print agenda', 'Check cable'], phone: '13900000001' },
    protected_paths: ['apps.source.records'],
  };
  const initial: any = { apps: {
    source: { records: [{ id: 'source', text: 'Alpha in Room 7' }] },
    wechat: { chats: [{ id: 'target' }], chatDrafts: { target: 'Hello, ', other: 'Keep' }, sendCount: 0 },
    notes: { notes: [{ id: 'old', title: 'Keep', content: 'Existing' }], todos: [] },
    calendar: { events: [{ id: 'target', title: 'Visit', location: 'Office', description: 'Bring ID. ', note: 'Bring ID. ' }] },
    sms: { composeDrafts: { saved: { recipient: '13900000002', body: 'Keep' } } },
  } };
  if (kind === 'wechat') contract.target.prefix = 'Hello, ';
  if (kind === 'calendar') contract.target.prefix = 'Bring ID. ';
  if (kind === 'checklist') initial.apps.notes.notes.push({ id: 'target', title: 'New record', hasChecklist: true, checklist: [], updatedAt: 1 });
  const current = structuredClone(initial);
  if (kind === 'wechat') current.apps.wechat.chatDrafts.target = 'Hello, Alpha, Room 7';
  if (kind === 'note') current.apps.notes.notes.push({ id: 'new', title: 'New record', content: 'Alpha, Room 7' });
  if (kind === 'checklist') current.apps.notes.notes[1].checklist = [
    { id: 'a', text: 'Print agenda', completed: false }, { id: 'b', text: 'Check cable', completed: false },
  ];
  if (kind === 'calendar') Object.assign(current.apps.calendar.events[0], { description: 'Bring ID. Alpha, Room 7', note: 'Bring ID. Alpha, Room 7' });
  if (kind === 'sms') current.apps.sms.composeDrafts.new = { recipient: '+86 13900000001', body: 'Alpha, Room 7' };
  return { contract, initial, current };
}

describe('portable workflow business and safety regressions', () => {
  for (const kind of ['wechat', 'note', 'checklist', 'calendar', 'sms'] as const) {
    it(`${kind}: accepts the business result and rejects the untouched initial state`, () => {
      const { contract, initial, current } = fixture(kind);
      expect(judgeWorkflow(initial, current, contract).passed).toBe(true);
      expect(judgeWorkflow(initial, initial, contract).passed).toBe(false);
    });
    it(`${kind}: rejects a correct result when protected source records change`, () => {
      const { contract, initial, current } = fixture(kind);
      current.apps.source.records[0].text = 'Changed';
      const result = judgeWorkflow(initial, current, contract);
      expect(result.business_passed).toBe(true);
      expect(result.safety_passed).toBe(false);
      expect(result.passed).toBe(false);
    });
  }

  it('binds the versioned contract to the declared source and target apps', () => {
    const { contract } = fixture('wechat');
    const task = { apps: ['source', 'wechat'], seed_contract: { workflow_v1: contract } };
    expect(workflowContract(task)).toBe(contract);
    expect(workflowContract({ apps: [] })).toBeNull();
    expect(() => workflowContract({ ...task, apps: ['wechat', 'source'] })).toThrow();
    expect(() => workflowContract({ ...task, seed_contract: { workflow_v1: { ...contract, version: 2 } } })).toThrow();
  });

  it('rejects a wrong chat, overwritten prefix, missing fact and forbidden sending', () => {
    for (const edit of [
      (s: any) => { s.chatDrafts.other = s.chatDrafts.target; s.chatDrafts.target = 'Hello, '; },
      (s: any) => { s.chatDrafts.target = 'Alpha, Room 7'; },
      (s: any) => { s.chatDrafts.target = 'Hello, Alpha'; },
      (s: any) => { s.sendCount = 1; },
    ]) {
      const { contract, initial, current } = fixture('wechat');
      edit(current.apps.wechat);
      expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
    }
  });

  it('requires exactly one visible new plain note while preserving existing notes', () => {
    for (const edit of [
      (s: any) => { s.notes.push({ ...s.notes[1], id: 'duplicate' }); },
      (s: any) => { s.notes[1].isPrivate = true; },
      (s: any) => { s.notes[1].hasChecklist = true; },
      (s: any) => { s.notes[0].content = 'Changed'; },
    ]) {
      const { contract, initial, current } = fixture('note');
      edit(current.apps.notes);
      expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
    }
  });

  it('requires the exact distinct unchecked checklist items and preserves list identity', () => {
    for (const edit of [
      (s: any) => { s.checklist.pop(); },
      (s: any) => { s.checklist.push({ ...s.checklist[0], id: 'duplicate' }); },
      (s: any) => { s.checklist[0].completed = true; },
      (s: any) => { s.title = 'Wrong list'; },
    ]) {
      const { contract, initial, current } = fixture('checklist');
      edit(current.apps.notes.notes[1]);
      expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
    }
  });

  it('allows the derived calendar note alias while protecting event identity fields', () => {
    const { contract, initial, current } = fixture('calendar');
    expect(judgeWorkflow(initial, current, contract).passed).toBe(true);
    current.apps.calendar.events[0].location = 'Different office';
    expect(judgeWorkflow(initial, current, contract).safety_passed).toBe(false);
  });

  it.each(['wechat', 'calendar'] as const)('%s: fills an initially empty target without requiring a prefix', kind => {
    const { contract, initial, current } = fixture(kind);
    delete contract.target.prefix;
    contract.target.initial_text = 'empty';
    if (kind === 'wechat') {
      initial.apps.wechat.chatDrafts.target = '';
      current.apps.wechat.chatDrafts.target = 'Alpha, Room 7';
    } else {
      Object.assign(initial.apps.calendar.events[0], { description: '', note: '' });
      Object.assign(current.apps.calendar.events[0], { description: 'Alpha, Room 7', note: 'Alpha, Room 7' });
    }
    expect(judgeWorkflow(initial, current, contract).passed).toBe(true);
    expect(judgeWorkflow(initial, initial, contract).passed).toBe(false);
    if (kind === 'wechat') initial.apps.wechat.chatDrafts.target = 'Unexpected existing draft';
    else initial.apps.calendar.events[0].description = 'Unexpected existing note';
    expect(judgeWorkflow(initial, current, contract).checks).toContainEqual({ name: 'initial_target_empty', passed: false });
  });

  it.each(['calendar', 'sms'] as const)('%s: optional sentence endings do not excuse wrong content', kind => {
    const { contract, initial, current } = fixture(kind);
    delete contract.target.prefix;
    delete contract.target.facts;
    contract.target.exact = kind === 'calendar' ? '带外套' : '您好，云帆设备的资料已收到';
    contract.target.ignore_terminal_punctuation = true;
    const setText = (text: string) => {
      if (kind === 'calendar') current.apps.calendar.events[0].description = text;
      else current.apps.sms.composeDrafts.new.body = text;
    };
    for (const ending of ['', '。', '.', '！', '?', '；', '。 \n']) {
      setText(contract.target.exact + ending);
      expect(judgeWorkflow(initial, current, contract).passed).toBe(true);
    }
    for (const wrong of ['', '轻装出行', '不带外套', contract.target.exact.repeat(2), contract.target.exact + '请确认',
      kind === 'calendar' ? '带，外套' : '您好，另一家公司的资料已收到']) {
      setText(wrong);
      expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
    }
    setText(contract.target.exact + '。');
    delete contract.target.ignore_terminal_punctuation;
    expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
  });

  it('terminal punctuation normalization preserves decimal digits and internal punctuation', () => {
    const { contract, initial, current } = fixture('sms');
    delete contract.target.facts;
    contract.target.exact = '金额12.5元，收到';
    contract.target.ignore_terminal_punctuation = true;
    current.apps.sms.composeDrafts.new.body = '金额12.5元，收到。';
    expect(judgeWorkflow(initial, current, contract).passed).toBe(true);
    for (const wrong of ['金额125元，收到', '金额12.6元，收到', '金额12.5元收到']) {
      current.apps.sms.composeDrafts.new.body = wrong;
      expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
    }
  });

  it('requires a full SMS recipient identity and rejects duplicate target drafts', () => {
    const { contract, initial, current } = fixture('sms');
    current.apps.sms.composeDrafts.new.recipient = '0001';
    expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
    current.apps.sms.composeDrafts.new.recipient = '13900000001';
    current.apps.sms.composeDrafts.duplicate = { ...current.apps.sms.composeDrafts.new };
    expect(judgeWorkflow(initial, current, contract).passed).toBe(false);
  });

  it('allows added browser history but rejects removal of initial entries', () => {
    const { contract, initial, current } = fixture('note');
    contract.source.app = 'browser';
    initial.apps.browser = { visitedUrls: ['local://existing'] };
    current.apps.browser = { visitedUrls: ['local://existing', 'local://new'] };
    expect(judgeWorkflow(initial, current, contract).passed).toBe(true);
    current.apps.browser.visitedUrls = ['local://new'];
    expect(judgeWorkflow(initial, current, contract).safety_passed).toBe(false);
  });

  it('checks ordered visible split apps and resolves the system orientation fallback', () => {
    const { contract } = fixture('wechat');
    contract.window = { orientation: 'side_by_side' };
    const state: any = { os: { tasks: [{ taskId: 'a', rootAppId: 'source' }, { taskId: 'b', rootAppId: 'wechat' }] },
      foldable: { posture: 'unfolded', multi_window: { mode: 'split', primary_task_id: 'a', secondary_task_id: 'b' } } };
    expect(workflowWindowMatches(contract, state)).toBe(true);
    state.foldable.posture = 'folded';
    expect(workflowWindowMatches(contract, state)).toBe(true);
    state.foldable.multi_window.split_orientation = 'side_by_side';
    expect(workflowWindowMatches(contract, state)).toBe(false);
    state.foldable.multi_window.split_orientation = 'stacked';
    expect(workflowWindowMatches(contract, state)).toBe(true);
    state.foldable.multi_window.primary_task_id = 'b';
    state.foldable.multi_window.secondary_task_id = 'a';
    expect(workflowWindowMatches(contract, state)).toBe(false);
    state.foldable.multi_window.primary_task_id = 'a';
    state.foldable.multi_window.secondary_task_id = 'b';
    state.foldable.posture = 'unfolded';
    expect(workflowWindowMatches(contract, state)).toBe(false);
    state.foldable.multi_window.split_orientation = 'side_by_side';
    expect(workflowWindowMatches(contract, state)).toBe(true);
    state.os.isLauncherVisible = true;
    expect(workflowWindowMatches(contract, state)).toBe(false);
    state.os.isLauncherVisible = false;
    state.os.tasks[1].rootAppId = 'other';
    expect(workflowWindowMatches(contract, state)).toBe(false);
  });
});
