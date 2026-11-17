/** Public experiment policy; never exposes private task facts to the model. */
export const UNFOLDED_STATIC = 'unfolded_static_v1';
export const UNFOLDED_MULTI_WINDOW = 'unfolded_static_multi_window_v1';
export const isUnfoldedStatic = task => task?.metadata?.benchmark_profile === UNFOLDED_STATIC;
export const isUnfoldedMultiWindow = task => task?.metadata?.benchmark_profile === UNFOLDED_MULTI_WINDOW;
export const isFixedUnfolded = task => isUnfoldedStatic(task) || isUnfoldedMultiWindow(task);

export function validateTaskProfile(task, options = {}) {
  if (options.allowFold) {
    if (isFixedUnfolded(task)) throw Error('Fixed-unfolded tasks do not permit --allow-fold');
    if (task.event_plan?.length || task.recovery || task.evaluator?.must_have_events?.length || task.evaluator?.require_post_transition_action)
      throw Error('--allow-fold cannot be mixed with scheduled posture events or recovery');
    if (!['folded','unfolded'].includes(task.initial_window?.posture))
      throw Error('--allow-fold requires a folded or unfolded initial posture');
    if (options.promptVersion && options.promptVersion !== 'v4') throw Error('--allow-fold requires v4 prompts');
  }
  if (!isFixedUnfolded(task)) return;
  const multiWindow = isUnfoldedMultiWindow(task), profile = task.metadata.benchmark_profile;
  const w = task.initial_window;
  const contract = task.seed_contract.workflow_v1;
  const window = contract?.window;
  if (task.condition !== 'static' || task.event_plan.length || task.recovery
    || w.posture !== 'unfolded' || w.layout !== 'inner_wide'
    || task.evaluator.must_have_events.length || task.evaluator.require_post_transition_action)
    throw Error(`Invalid ${profile} task policy`);
  if (multiWindow) {
    if (!window || !['side_by_side','stacked'].includes(window.orientation)
      || w.mode !== (window.create_split ? 'fullscreen' : 'split')
      || (!window.create_split && (w.split_orientation !== window.orientation
        || JSON.stringify(w.split_apps) !== JSON.stringify([contract.source.app, contract.target.app]))))
      throw Error(`Invalid ${profile} window contract`);
  } else if (w.mode !== 'fullscreen' || window) throw Error('Invalid unfolded_static_v1 task policy');
  if (!multiWindow && options.allowSplit)
    throw Error('unfolded_static_v1 requires v4 prompts and does not allow split windows');
  if (options.promptVersion && options.promptVersion !== 'v4') throw Error(`${profile} requires v4 prompts`);
}

// Runs only in the trusted evaluator/browser, not in model observations. Sticky
// violations prevent changing posture/layout and changing back to evade scoring.
export async function installTaskProfileGuard(cdp, task) {
  validateTaskProfile(task);
  if (!isFixedUnfolded(task)) return;
  const modes = isUnfoldedMultiWindow(task) ? ['fullscreen', 'split'] : ['fullscreen'];
  await cdp.eval(`(() => {
    window.__UNFOLDED_STATIC_GUARD__?.dispose();
    const violations = [];
    const inspect = () => {
      const s = window.__FOLDAGENT__.getState();
      if (s.posture !== 'unfolded' || s.layout_id !== 'inner_wide'
          || s.active_display !== 'inner' || !${JSON.stringify(modes)}.includes(s.multi_window.mode)) {
        violations.push({ posture: s.posture, layout: s.layout_id, mode: s.multi_window.mode });
        window.__FOLDAGENT_BENCH__.recordViolation('forbidden_actions');
      }
    };
    for (const event of ['foldagent:posturechange', 'foldagent:windowchange']) window.addEventListener(event, inspect);
    window.__UNFOLDED_STATIC_GUARD__ = { violations, inspect, dispose() {
      for (const event of ['foldagent:posturechange', 'foldagent:windowchange']) window.removeEventListener(event, inspect);
    }};
    inspect();
    if (violations.length) throw Error('Fixed-unfolded initial window mismatch');
  })()`);
}
