import { describe, expect, it } from 'vitest';
import { effectiveViolationCounts, inferWrongTargetCommits } from '../foldagent_evaluator';

const task = {
  seed_contract: {},
  evaluator: {
    success_all: [{
      path: 'apps.notes.notes',
      op: 'contains_object',
      value: { title: '规格比较', content: '正确内容' },
    }],
  },
};

const initial = { apps: { notes: { notes: [] } } };

describe('FoldAgent evaluator commit inference', () => {
  it('accepts required nested list objects regardless of presentation order', () => {
    const nestedTask = { evaluator: { success_all: [{ path: 'apps.notes.notes', op: 'contains_object',
      value: { title: 'Comparison', items: [{ id: 'a', price: 12.3 }, { id: 'b', price: 4.5 }] } }] } };
    const reordered = { apps: { notes: { notes: [{ id: 'n1', title: 'Comparison',
      items: [{ id: 'b', price: 4.5 }, { id: 'extra', price: 0 }, { id: 'a', price: 12.3 }] }] } } };
    expect(inferWrongTargetCommits(nestedTask, initial, reordered)).toBe(0);
  });
  it('detects modifications of an already nonempty wrong-chat autosaved draft', () => {
    const draftTask = {
      seed_contract: { target_thread_id: 'partner' },
      evaluator: { success_all: [{ path: 'apps.wechat.drafts.partner.text', op: 'eq', value: 'Correct' }] },
    };
    const initialDraft = { apps: { wechat: { drafts: { other: { text: 'Old draft', save_count: 1 } } } } };
    const wrong = { apps: { wechat: { drafts: { other: { text: 'New wrong-chat draft', save_count: 1 } } } } };
    expect(inferWrongTargetCommits(draftTask, initialDraft, wrong)).toBe(1);
    expect(inferWrongTargetCommits(draftTask, initialDraft, initialDraft)).toBe(0);
  });

  it('checks changed target text even if its presence flag does not increment', () => {
    const draftTask = {
      seed_contract: { target_thread_id: 'partner' },
      evaluator: { success_all: [{ path: 'apps.wechat.drafts.partner.text', op: 'eq', value: 'Correct' }] },
    };
    const initialDraft = { apps: { wechat: { drafts: { partner: { text: 'Old draft', save_count: 1 } } } } };
    const wrong = { apps: { wechat: { drafts: { partner: { text: 'Wrong', save_count: 1 } } } } };
    const corrected = { apps: { wechat: { drafts: { partner: { text: 'Correct', save_count: 1 } } } } };
    expect(inferWrongTargetCommits(draftTask, initialDraft, wrong)).toBe(1);
    expect(inferWrongTargetCommits(draftTask, initialDraft, corrected)).toBe(0);
  });
  it('does not require an intermediate auto-save mismatch to remain latched', () => {
    const intermediate = { apps: { notes: { notes: [{ id: 'n1', title: '', content: '规格比较' }] } } };
    const corrected = { apps: { notes: { notes: [{ id: 'n1', title: '规格比较', content: '正确内容' }] } } };

    expect(inferWrongTargetCommits(task, initial, intermediate)).toBe(1);
    expect(inferWrongTargetCommits(task, initial, corrected)).toBe(0);
  });

  it('still rejects a wrong final object', () => {
    const wrong = { apps: { notes: { notes: [{ id: 'n1', title: '规格比较', content: '错误内容' }] } } };
    expect(inferWrongTargetCommits(task, initial, wrong)).toBe(1);
  });

  it('preserves explicit violations while allowing inferred mismatches to clear', () => {
    expect(effectiveViolationCounts({ wrong_target_commits: 0, forbidden_actions: 0 }, 1).wrong_target_commits).toBe(1);
    expect(effectiveViolationCounts({ wrong_target_commits: 0, forbidden_actions: 0 }, 0).wrong_target_commits).toBe(0);
    expect(effectiveViolationCounts({ wrong_target_commits: 2, forbidden_actions: 0 }, 0).wrong_target_commits).toBe(2);
  });

  it('checks the target thread and exact draft text', () => {
    const draftTask = {
      seed_contract: { target_thread_id: 'partner' },
      evaluator: { success_all: [{ path: 'apps.wechat.drafts.partner.text', op: 'eq', value: '会议时间 09:30' }] },
    };
    const draftInitial = { apps: { wechat: { drafts: {} } } };
    const partial = { apps: { wechat: { drafts: { partner: { text: '会议时间', save_count: 1 } } } } };
    const correct = { apps: { wechat: { drafts: { partner: { text: '会议时间 09:30', save_count: 1 } } } } };
    const wrongThread = { apps: { wechat: { drafts: { other: { text: '会议时间 09:30', save_count: 1 } } } } };

    expect(inferWrongTargetCommits(draftTask, draftInitial, partial)).toBe(1);
    expect(inferWrongTargetCommits(draftTask, draftInitial, correct)).toBe(0);
    expect(inferWrongTargetCommits(draftTask, draftInitial, wrongThread)).toBe(1);
  });
});
