import { objectContains } from './foldagent_rules';

export type EvaluatorRule = {
  path: string;
  op: string;
  value: unknown;
};

export type EvaluatorTask = {
  seed_contract?: Record<string, unknown>;
  evaluator?: { success_all?: EvaluatorRule[] };
};

type Dict = Record<string, any>;

/** Definite failures dominate; unresolved evidence must not become false. */
export function combineEvidenceChecks(checks: readonly (boolean | null)[]): boolean | null {
  if (checks.some(check => check !== true && check !== false && check !== null)) throw Error('Invalid evidence check');
  return checks.includes(false) ? false : checks.includes(null) ? null : true;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const getPath = (root: any, path: string) =>
  path.split('.').reduce((value, key) => value?.[key], root);


/**
 * Infer wrong-target commits from the current persisted state only.
 *
 * Many mobile apps auto-save a newly created object before all fields are
 * filled. Callers must not latch an intermediate mismatch permanently: a
 * later report may legitimately return zero after the same object is fixed.
 */
export function inferWrongTargetCommits(task: EvaluatorTask | null, initialState: Dict, state: Dict) {
  if (!task) return 0;
  let wrong = 0;
  const successRules = task.evaluator?.success_all || [];
  const expectedByPath = new Map<string, unknown[]>();
  for (const rule of successRules) {
    if (rule.op !== 'contains_object') continue;
    expectedByPath.set(rule.path, [...(expectedByPath.get(rule.path) || []), rule.value]);
  }
  for (const [path, expected] of expectedByPath) {
    const current = getPath(state, path);
    const initial = getPath(initialState, path);
    if (!Array.isArray(current)) continue;
    const added = current.filter(item => !Array.isArray(initial) || !initial.some(old => same(old, item)));
    wrong += added.filter(item => !expected.some(value => objectContains(item, value))).length;
  }

  const targetThread = task.seed_contract?.target_thread_id;
  for (const [appId, app] of Object.entries(state.apps || {}) as Array<[string, any]>) {
    for (const [threadId, draft] of Object.entries(app?.drafts || {}) as Array<[string, any]>) {
      const initialDraft = getPath(initialState, `apps.${appId}.drafts.${threadId}`) || {};
      const saveDelta = Number(draft?.save_count || 0) - Number(initialDraft?.save_count || 0);
      // WeChat auto-saves each keystroke. Its legacy save_count is a presence
      // flag, not a monotonic commit counter; edits of nonempty drafts need
      // an initial-to-final text diff even when the flag remains one.
      const changedAutosave = appId === 'wechat' && !same(draft?.text ?? '', initialDraft?.text ?? '');
      if (saveDelta <= 0 && !changedAutosave) continue;
      const expectedTextRule = successRules.find(
        rule => rule.path === `apps.${appId}.drafts.${threadId}.text` && rule.op === 'eq',
      );
      if ((targetThread && threadId !== targetThread)
        || (expectedTextRule && !same(draft?.text, expectedTextRule.value))
        || (!expectedTextRule && targetThread === threadId)) {
        wrong += Math.max(saveDelta, changedAutosave ? 1 : 0);
      }
    }
  }
  return wrong;
}

export function effectiveViolationCounts(
  explicit: Dict,
  inferredWrongTargetCommits: number,
) {
  return {
    ...explicit,
    wrong_target_commits: Math.max(
      Number(explicit?.wrong_target_commits || 0),
      Number(inferredWrongTargetCommits || 0),
    ),
  };
}
