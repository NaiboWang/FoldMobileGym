/** FoldAgentBench runtime with opt-in agent fold/unfold, separate from scheduled events. */

import { combineEvidenceChecks, effectiveViolationCounts, inferWrongTargetCommits } from './foldagent_evaluator';
import { getPriceNoteTaskContract, judgePriceNote } from './foldagent_price_note_judge';
import { workflowContract, judgeWorkflow, observeWorkflow, workflowAppContext, workflowWindowMatches } from './foldagent_workflow_contract';
import { singleAppContract, judgeSingleApp, observeSingleApp, validateSingleAppInitial } from './foldagent_single_app_contract';
import { staticSingleContract, prepareSingleFiles, refreshSingleFiles, singleFileSnapshot } from './foldagent_single_app_static';
import { workflowActivity, workflowRoute, workflowRecoveryIdentity } from './foldagent_workflow_recovery';
import { AppNavigatorRegistry } from './os/AppNavigatorRegistry';
import { captureRetainedApps, retainedAppIds, retainedContextEqual } from './foldagent_recovery_context';
import { settleShopNavigation } from './foldagent_navigation_settle';
import { validateInitialWindow, settleInitialWindow, type InitialWindowConfig } from './foldagent_initial_window';
import { getInstalledPackageIds } from './os/installedPackageIds';
import { objectContains } from './foldagent_rules';
import { compareRecoveredForm, countBusinessCommits, hasCartEntryProgress, hasDraftEntryProgress, hasTargetCommitProgress, isExpectedShopRoute, targetAppIds } from './foldagent_progress';
import { resolveMeituanShops } from './apps/MeituanWaimai/data';
import { menuFactKey, menuFactRequirements } from './apps/MeituanWaimai/sourceFacts';
import { isExpectedMeetingDetail, meetingFactRequirements } from './foldagent_meeting_source';
import { fromTimestamp, useSimulatedTime } from './os/TimeService';
import { getLocale } from './os/locale';
import { resolveAppStrings } from './os/useAppStrings';
import { strings as meetingStrings } from './apps/TencentMeeting/res/strings';
import { stringsEn as meetingStringsEn } from './apps/TencentMeeting/res/strings.en';
import { formatMeetingFullDate } from './apps/TencentMeeting/utils/localization';

type Dict = Record<string, any>;
type Posture = 'folded' | 'unfolded' | 'tabletop';
type AgentAction = { id: string; kind?: string; params?: Dict; timestamp?: number; valid?: boolean; terminal?: boolean };
type EpisodeMetadata = { task_hash: string; seed_hash: string; run_metadata: Dict };

type Rule = { path: string; op: 'eq' | 'neq' | 'contains' | 'contains_object' | 'count_eq' | 'unchanged' | 'delta_eq'; value: any };
type TaskEvent = {
  event_id: string;
  controller: 'benchmark';
  trigger: { all: Array<{ path: string; equals: any }>; max_wait_steps: number };
  transition: { from_posture: Posture; to_posture: Posture; duration_steps: number };
  fault?: { type: 'recreate_app'; app_id: string; preserve_persisted_state: true };
};
type BenchTask = {
  id: string;
  pair_id: string;
  condition?: string;
  metadata?: Dict;
  apps: string[];
  seed_contract: Dict;
  initial_window: InitialWindowConfig;
  event_plan: TaskEvent[];
  evaluator: {
    success_all: Rule[];
    safety_all: Rule[];
    must_have_events: string[];
    require_post_transition_action: boolean;
    max_invalid_actions: number;
    max_repeated_actions: number;
  };
  recovery?: {
    app_id: string;
    required_context: string[];
    retained_apps?: string[];
    context_rules?: Rule[];
    max_recovery_steps: number;
    no_duplicate_commit: true;
    capture_strategy: 'persisted_plus_visible_form_hash' | 'persisted_plus_target_form_hash';
    completion_condition: 'success_all';
  } | null;
};

type Evidence = {
  event_id: string;
  controller: 'benchmark';
  trigger_step: number;
  trigger_state_hash: string;
  posture_before: string;
  posture_after: string;
  layout_before: string;
  layout_after: string;
  pre_state: Dict;
  post_state: Dict;
  transition_duration_steps: number;
  recovery_deadline_step?: number;
  context_hash_before?: string;
  context_hash_after?: string;
  context_retained?: boolean;
  context_checks?: Array<{ name: string; passed: boolean; before?: any; after?: any }>;
};

type ActionEvidence = AgentAction & {
  step: number;
  after_transition: boolean;
  after_event_ids: string[];
  pre_state_hash: string;
  post_state_hash: string;
  effectful: boolean;
  valid: boolean;
};

const SOURCE_PROBES: Record<string, [string, string, string]> = {
  workspace_docs: ['selected_document_id', 'verified_document_ids', 'document_id'],
  food_info: ['selected_product_id', 'verified_product_ids', 'product_id'],
  map: ['selected_place_id', 'verified_place_ids', 'place_id'],
  video: ['selected_asset_id', 'verified_asset_ids', 'asset_id'],
  gallery: ['selected_asset_id', 'verified_asset_ids', 'asset_id'],
  file_manager: ['selected_file_id', 'verified_file_ids', 'file_id'],
  fitness: ['selected_activity_id', 'verified_activity_ids', 'activity_id'],
  mail: ['selected_message_id', 'verified_message_ids', 'message_id'],
  contacts: ['selected_contact_id', 'verified_contact_ids', 'contact_id'],
  browser: ['selected_page_id', 'verified_page_ids', 'url_id'],
  taobao: ['selected_product_id', 'verified_product_ids', 'product_id'],
  calendar: ['selected_event_id', 'verified_event_ids', 'event_id'],
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const getPath = (root: any, path: string) => path.split('.').reduce((value, key) => value?.[key], root);
const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const stable = (value: any): any => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
};
const sha256 = async (value: any) => {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};
const semanticSnapshot = (state: Dict, appIds: string[]) => {
  const runtime = state.runtime || {};
  return {
    apps: Object.fromEntries(appIds.map(appId => [appId, state.apps?.[appId] ?? null])),
    runtime: {
      ...runtime,
      app_routes: Object.fromEntries(appIds.map(appId => [appId, runtime.app_routes?.[appId] || '/'])),
    },
  };
};
const evidenceSnapshot = (state: Dict, appIds: string[]) => ({
  ...semanticSnapshot(state, appIds),
  foldable: state.foldable || {},
});
const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const devicePosture = (posture: Posture) => posture === 'tabletop' ? 'half_folded' : posture;
const layoutForPosture = (posture: Posture) => posture === 'folded' ? 'cover_single' : posture === 'tabletop' ? 'inner_book' : 'inner_wide';

const countCommits = countBusinessCommits;

const COUNTER_ALIASES: Record<string, string> = {
  created_count: 'createdCount', deleted_count: 'deletedCount', mutation_count: 'mutationCount',
  external_navigation_count: 'externalNavigationCount', order_count: 'orderCount',
  location_permission_count: 'locationPermissionCount',
};
const cleanSeedApps = (seedState: Dict, appIds: string[]) => Object.fromEntries(appIds.map(appId => {
  const declared = seedState?.apps?.[appId] || {};
  const counters = Object.fromEntries(Object.entries(COUNTER_ALIASES)
    .filter(([source]) => typeof declared[source] === 'number')
    .map(([source, target]) => [target, declared[source]]));
  return [appId, { ...counters, ...(clone(seedState?.raw_apps?.[appId] || {})) }];
}));

const SOURCE_COLLECTIONS: Record<string, [string, string]> = {
  workspace_docs: ['documents', 'document_id'], food_info: ['products', 'product_id'],
  video: ['assets', 'asset_id'], fitness: ['activities', 'activity_id'], mail: ['messages', 'message_id'],
  calendar: ['events', 'event_id'], contacts: ['contacts', 'contact_id'], taobao: ['products', 'product_id'],
};

const FORBIDDEN_POSTURE_ACTIONS = new Set(['fold', 'unfold', 'set_posture', 'set_hinge_angle']);
const EXPLICIT_VERIFY_APPS = new Set(['workspace_docs', 'food_info', 'video', 'fitness', 'mail']);
const expectedSourceIds = (seed: Dict, appId: string, seedField: string): string[] => {
  let expected = seed[seedField];
  if (appId === 'food_info' && expected == null) expected = seed.answer_product_id ?? seed.product_ids;
  if (appId === 'browser' && expected == null) expected = seed.page_id;
  return (Array.isArray(expected) ? expected : expected == null ? [] : [expected]).map(String);
};
const persistedContext = (app: Dict) => {
  const value = clone(app || {});
  delete value.route;
  delete value.transient;
  delete value.lifecycle;
  return value;
};
const isVisibleField = (field: HTMLElement) => {
  const style = getComputedStyle(field);
  const rect = field.getBoundingClientRect();
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) return false;
  const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
  const y = Math.max(0, Math.min(innerHeight - 1, rect.top + Math.min(rect.height / 2, 24)));
  const hit = document.elementFromPoint(x, y);
  return Boolean(hit && (hit === field || field.contains(hit) || hit.contains(field)));
};
// Both fact texts must fit on screen and survive hit-testing through scroll
// clipping/overlays. DOM presence alone cannot establish menu delivery.
const isDeliveredMenuText = (node: HTMLElement) => {
  for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  }
  const rect = node.getBoundingClientRect();
  if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight) return false;
  if (!isVisibleField(node)) return false;
  return [[rect.left + 1, rect.top + 1], [rect.right - 1, rect.bottom - 1]].every(([x, y]) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit && (hit === node || node.contains(hit)));
  });
};
const visibleFormContext = () => Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select'))
  .filter(field => !field.disabled && isVisibleField(field))
  .map((field, index) => ({
    key: field.dataset.benchmarkField || field.getAttribute('name') || `${field.tagName.toLowerCase()}:${field.getAttribute('type') || ''}:${index}`,
    value: field.value,
  }));
// Recovery preserves authored values, not the scroll offset of the recreated
// editor. This private snapshot is deliberately distinct from screenshot-based
// source observation: clipped inputs count here, hidden/background apps do not.
const targetFormContext = (appId: string) => Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select'))
  .filter(field => {
    if (field.disabled || field.closest<HTMLElement>('[data-app-id]')?.dataset.appId !== appId) return false;
    const rect = field.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    for (let node: HTMLElement | null = field; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      if (node.id === 'root') break;
    }
    return true;
  })
  .map((field, index) => ({
    key: field.dataset.benchmarkField || field.getAttribute('name') || `${field.tagName.toLowerCase()}:${field.getAttribute('type') || ''}:${index}`,
    value: field.value,
  }));
const waitForRecoveryContext = async (appId: string, before: any, timeoutMs = 2500, workflow = false, targetForm = false) => {
  const deadline = performance.now() + timeoutMs;
  let current: { persisted: Dict; form: Array<{ key: string; value: string }>; retained?: Dict } = { persisted: {}, form: [] };
  let stableMatches = 0;
  while (performance.now() < deadline) {
    await settle();
    const os = window.__OS__?.getState?.();
    const state: Dict = clone(window.__SIM__?.getState?.() || { apps: {} }) as Dict;
    current = {
      persisted: workflow ? workflowAppContext(appId, state.apps?.[appId]) : persistedContext(state.apps?.[appId]),
      form: (targetForm ? targetFormContext(appId) : visibleFormContext()).filter(item => String(item.value).trim().length > 0),
      ...(before.retained ? { retained: captureRetainedApps(state.apps, Object.keys(before.retained)) } : {}),
    };
    // An expanded window may reveal more controls. Require the original
    // fields and values, not an identical visible-field set; persisted data
    // still has to match exactly.
    if (os?.activeAppId === appId && same(before.persisted, current.persisted)
      && compareRecoveredForm(before.form, current.form).valuesPreserved
      && (!before.retained || retainedContextEqual(before.retained, current.retained))) {
      stableMatches += 1;
      if (stableMatches >= 3) return current;
    } else {
      stableMatches = 0;
    }
    await pause(50);
  }
  return current;
};
const visibleInteractionContext = (includeUntaggedScroll = false) => {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return {
    // A screenshot changes when a visible tagged container scrolls even if
    // business state and focused input do not. Exclude hidden/background
    // containers; a wheel at a boundary still has unchanged offsets.
    scroll_containers: Array.from(document.querySelectorAll<HTMLElement>(includeUntaggedScroll ? '[data-scroll-container], [data-app-id] *' : '[data-scroll-container]'))
      .filter(node => node.hasAttribute('data-scroll-container') || (
        /auto|scroll/.test(getComputedStyle(node).overflowY + getComputedStyle(node).overflowX)
        && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)))
      .filter(isVisibleField)
      .map((node, index) => ({
        app_id: node.closest<HTMLElement>('[data-app-id]')?.dataset.appId || null,
        id: node.dataset.scrollContainer || `visible-scroll-${index}`,
        left: node.scrollLeft,
        top: node.scrollTop,
      })),
    active_field: active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)
      ? active.dataset.benchmarkField
        || active.getAttribute('name')
        || active.getAttribute('aria-label')
        || active.getAttribute('placeholder')
        || `${active.tagName.toLowerCase()}:${active.getAttribute('type') || ''}`
      : null,
  };
};

export class FoldAgentBenchmarkController {
  private task: BenchTask | null = null;
  private step = 0;
  private fired = new Set<string>();
  private timedOut = new Set<string>();
  private anchors: Dict = {};
  private evidence: Evidence[] = [];
  private actions: ActionEvidence[] = [];
  private invalidActions = 0;
  private repeatedActions = 0;
  private violations = { real_world_side_effects: 0, forbidden_actions: 0, wrong_target_commits: 0, duplicate_commits: 0 };
  private initialState: Dict = {};
  private singleInitialReady = false;
  private singleSafety = new Set<string>();
  private lastSignature = '';
  private queue = Promise.resolve();
  private automatic = true;
  private allowAgentPosture = false;
  private seenAutomatic = new Map<string, number>();
  private lastSemanticState: Dict = {};
  private initialStateHash = '';
  private seedApplied = false;
  private requestedWindow: Dict = {};
  private effectiveWindow: Dict = {};
  private goalSatisfiedStep: number | null = null;
  private openedSourceIds = new Set<string>();
  private verifiedSourceIds = new Set<string>();
  private deliveredMenuFacts = new Set<string>();
  private deliveredMeetingFacts = new Set<string>();
  private interactedTargetFields = new Set<string>();
  private seedChecks: Array<{ path: string; expected: string; passed: boolean }> = [];
  private episodeMetadata: EpisodeMetadata | null = null;
  private workflowFacts = new Set<number>();
  private workflowSafety = new Set<string>();
  private workflowObservedStep = -1;
  private workflowActionEligible = false;
  private workflowSplitFacts = new Set<number>();
  private workflowObservations: Dict[] = [];
  private workflowSplitRead = false;
  private workflowSplitEdit = false;
  private workflowClosedSource = false;
  private workflowPreviousBusiness = false;

  constructor() {
    window.addEventListener('mobilegym:agent-action', event => {
      if (!this.automatic) return;
      this.enqueue((event as CustomEvent<AgentAction>).detail);
    });
    window.addEventListener('click', event => {
      if (!this.automatic || !this.task) return;
      const target = event.target instanceof Element ? event.target : null;
      const node = target?.closest<HTMLElement>('[data-action],[data-trigger]') || null;
      const interactive = target?.closest<HTMLElement>('button,a,[role="button"],input,textarea,select') || null;
      if (!node && !interactive) return;
      const id = node?.dataset.action || node?.dataset.trigger || 'dom.click';
      const raw = node?.dataset.actionParams || node?.dataset.triggerParams;
      let params: Dict = {};
      try { params = raw ? JSON.parse(raw) : {}; } catch { params = {}; }
      if (!node && interactive) {
        params = {
          target: interactive.getAttribute('aria-label') || interactive.textContent?.trim().slice(0, 80) || interactive.tagName.toLowerCase(),
          ...(interactive.dataset.benchmarkField ? { benchmark_field: interactive.dataset.benchmarkField } : {}),
        };
      }
      const signature = JSON.stringify([id, params]);
      const now = performance.now();
      if (now - (this.seenAutomatic.get(signature) || -Infinity) < 40) return;
      this.enqueue({ id, kind: node?.dataset.action ? 'action' : node?.dataset.trigger ? 'transition' : 'interaction', params, timestamp: Date.now() });
    });
  }

  async start(task: BenchTask, options: { automatic?: boolean; openInitialApp?: boolean; seedState?: Dict; strictSeed?: boolean; episodeMetadata?: EpisodeMetadata; allowAgentPosture?: boolean } = {}) {
    if (!task?.id || !task?.pair_id || !Array.isArray(task.event_plan)) throw new Error('Invalid FoldAgentBench task');
    if (task.event_plan.some(event => event.controller !== 'benchmark')) throw new Error('All posture events must be benchmark-owned');
    if (options.allowAgentPosture) {
      if (['unfolded_static_v1', 'unfolded_static_multi_window_v1'].includes(task.metadata?.benchmark_profile))
        throw new Error('Fixed-unfolded tasks do not permit agent fold/unfold');
      if (task.event_plan.length || task.recovery || task.evaluator.must_have_events.length || task.evaluator.require_post_transition_action)
        throw new Error('Agent fold/unfold cannot be mixed with scheduled posture events or recovery');
      if (!['folded', 'unfolded'].includes(task.initial_window?.posture))
        throw new Error('Agent fold/unfold requires a folded or unfolded initial posture');
    }
    // Fail before resetting data: requesting a mode cannot establish its panes.
    validateInitialWindow(task.initial_window, task.apps, options.openInitialApp !== false);
    if (options.openInitialApp !== false) {
      const installed = new Set(getInstalledPackageIds());
      for (const app of task.initial_window.split_apps ?? [task.initial_window.focused_app]) {
        if (!installed.has(app)) throw new Error(`Initial app is not installed: ${app}`);
      }
    }
    getPriceNoteTaskContract(task);
    workflowContract(task);
    singleAppContract(task);
    retainedAppIds(task);
    this.task = clone(task);
    this.step = 0;
    this.fired.clear();
    this.timedOut.clear();
    this.anchors = {};
    this.singleInitialReady = false;
    this.singleSafety.clear();
    this.evidence = [];
    this.actions = [];
    this.invalidActions = 0;
    this.repeatedActions = 0;
    this.violations = { real_world_side_effects: 0, forbidden_actions: 0, wrong_target_commits: 0, duplicate_commits: 0 };
    this.lastSignature = '';
    this.automatic = options.automatic !== false;
    this.allowAgentPosture = options.allowAgentPosture === true;
    this.initialStateHash = '';
    this.seedApplied = false;
    this.goalSatisfiedStep = null;
    this.openedSourceIds.clear();
    this.verifiedSourceIds.clear();
    this.deliveredMenuFacts.clear();
    this.deliveredMeetingFacts.clear();
    this.interactedTargetFields.clear();
    this.seedChecks = [];
    this.workflowFacts.clear(); this.workflowSafety.clear(); this.workflowObservedStep = -1;
    this.workflowSplitFacts.clear(); this.workflowObservations = [];
    this.workflowActionEligible = false;
    this.workflowSplitRead = false; this.workflowSplitEdit = false;
    this.workflowClosedSource = false; this.workflowPreviousBusiness = false;
    this.episodeMetadata = options.episodeMetadata ? clone(options.episodeMetadata) : null;
    if (this.episodeMetadata) {
      const taskHash = await sha256(task);
      const seedHash = await sha256(options.seedState || {});
      if (taskHash !== this.episodeMetadata.task_hash) throw new Error('Episode task_hash mismatch');
      if (seedHash !== this.episodeMetadata.seed_hash) throw new Error('Episode seed_hash mismatch');
    }
    this.requestedWindow = clone(task.initial_window);
    if (!window.__SIM__?.resetState || !window.__SIM__?.setState) throw new Error('MobileGym __SIM__ runtime is unavailable');
    if (options.strictSeed && !options.seedState) throw new Error(`Task ${task.id} requires an explicit seedState`);
    await window.__SIM__.resetState();
    if ((workflowContract(task) || singleAppContract(task)) && options.seedState?.clock) {
      useSimulatedTime(options.seedState.clock.timestamp, false);
    }
    // resetState restores persistent simulator data, but system overlays are
    // volatile OS state.  An open notification/control shade must never leak
    // from one episode into the next episode's initial observation.
    window.__OS__?.shade?.close?.();
    await window.__SIM__.waitForData?.(task.apps);
    if (options.seedState) {
      const seedApps = cleanSeedApps(options.seedState, task.apps);
      const missing = task.apps.filter(id => !(id in seedApps));
      if (missing.length) throw new Error(`Seed state is missing task apps: ${missing.join(', ')}`);
      window.__SIM__.setState({ apps: seedApps,
        ...((workflowContract(task) || staticSingleContract(task)) && options.seedState.os ? { os: clone(options.seedState.os) } : {}),
      }, { deep: false, reload: false });
      this.seedApplied = true;
      const singleStatic = staticSingleContract(task);
      if (singleStatic) await prepareSingleFiles(options.seedState, singleStatic);
    } else {
      // resetState intentionally suspends persistence until reload or setState.
      // This controller continues in the same document, including without a seed.
      // An empty restore completes reset without modifying any app/OS data.
      window.__SIM__.setState({}, { deep: false, reload: false });
    }
    window.__FOLDAGENT__?.setMultiWindow('fullscreen');
    window.__FOLDAGENT__?.setPosture(devicePosture(task.initial_window.posture), { reset_events: true });
    const initial = task.initial_window;
    if (options.openInitialApp !== false) {
      const apps = initial.mode === 'split' ? initial.split_apps! : [initial.focused_app];
      for (const app of apps) window.__OS__?.openApp(app);
      if (initial.mode === 'split') {
        const tasks = window.__OS__!.getState().tasks;
        const paneTasks = apps.map(app => tasks.find(task => task.rootAppId === app));
        if (paneTasks.some(task => !task)) throw new Error('Initial split apps did not create OS tasks');
        window.__FOLDAGENT__!.setMultiWindow('split', paneTasks[0]!.taskId, paneTasks[1]!.taskId,
          initial.divider_ratio ?? 0.5, null, 0.5, initial.split_orientation);
      }
      // Reactivate without resetting either app's route or creating a new task.
      const focused = window.__OS__!.getState().tasks.find(task => task.rootAppId === initial.focused_app)!;
      window.__OS__!.launchTaskById(focused.taskId);
    }
    await settle();
    if (options.openInitialApp !== false) {
      const appId = task.initial_window.focused_app;
      await settleInitialWindow({ appId, posture: devicePosture(task.initial_window.posture), layout: task.initial_window.layout,
        mode: initial.mode, orientation: initial.split_orientation }, {
        read: () => {
          const os = window.__OS__?.getState?.();
          const foldable = window.__FOLDAGENT__?.getState?.();
          const apps = initial.mode === 'split' ? initial.split_apps! : [appId];
          const visible = apps.every((id, index) => [...document.querySelectorAll<HTMLElement>('[data-app-id]')].some(node => {
            const rect = node.getBoundingClientRect();
            return node.dataset.appId === id && rect.width > 0 && rect.height > 0
              && getComputedStyle(node).visibility !== 'hidden'
              && node.dataset.foldagentPane === (initial.mode === 'split' ? index === 0 ? 'primary' : 'secondary' : 'fullscreen');
          }));
          return { appId: os?.activeAppId, posture: foldable?.posture, layout: foldable?.layout_id, visible,
            mode: foldable?.multi_window?.mode,
            orientation: foldable?.multi_window?.split_orientation,
            routeReady: apps.every(id => Boolean(window.__OS__?.getAppRoute(id)?.path)),
            launcher: Boolean(os?.isLauncherVisible), recents: Boolean(os?.isRecentsVisible) };
        }, nextFrame: settle, now: () => performance.now(),
      });
    }
    // Gallery mounting may reload file metadata objects. Refresh actual byte
    // evidence after the initial UI has settled, before freezing the baseline.
    await refreshSingleFiles(staticSingleContract(task));
    this.initialState = this.privateSnapshot();
    const single = singleAppContract(task);
    if (single) validateSingleAppInitial(this.initialState, single);
    this.singleInitialReady = true;
    this.businessJudgment(this.initialState); // Invalid source/fixture data throws at setup.
    const sourceSpec = SOURCE_COLLECTIONS[task.apps[0]];
    if (sourceSpec) {
      const [collection, seedKey] = sourceSpec;
      let expected = task.seed_contract[seedKey];
      if (task.apps[0] === 'food_info' && expected == null) expected = task.seed_contract.answer_product_id || task.seed_contract.product_ids;
      const expectedIds = (Array.isArray(expected) ? expected : expected == null ? [] : [expected]).map(String);
      const records = this.initialState.apps?.[task.apps[0]]?.[collection] || [];
      this.seedChecks = expectedIds.map(id => ({ path: `apps.${task.apps[0]}.${collection}`, expected: id, passed: records.some((record: any) => String(record?.id) === id) }));
      if (options.strictSeed && this.seedChecks.some(check => !check.passed)) throw new Error(`Seed fixture missing required source object(s): ${this.seedChecks.filter(check => !check.passed).map(check => check.expected).join(', ')}`);
    }
    this.lastSemanticState = clone(this.actionSemanticState(this.initialState));
    this.initialStateHash = await sha256(this.lastSemanticState);
    const foldable = this.initialState.foldable || {};
    this.effectiveWindow = {
      posture: foldable.posture || '', layout: foldable.layout_id || '',
      focused_app: this.initialState.runtime?.active_app_id || '', mode: foldable.multi_window?.mode || 'unknown',
      ...(foldable.multi_window?.mode === 'split' ? {
        split_apps: [foldable.multi_window.primary_task_id, foldable.multi_window.secondary_task_id]
          .map(id => window.__OS__?.getState().tasks.find(task => task.taskId === id)?.rootAppId),
        split_orientation: foldable.multi_window.split_orientation ?? (foldable.posture === 'folded' ? 'stacked' : 'side_by_side'),
        divider_ratio: foldable.multi_window.divider_ratio,
      } : {}),
    };
    if (task.initial_window.layout && foldable.layout_id !== task.initial_window.layout) {
      throw new Error(`Initial layout mismatch: requested ${task.initial_window.layout}, got ${foldable.layout_id || 'unknown'}`);
    }
    return this.getReport();
  }

  stop() { this.task = null; this.allowAgentPosture = false; }

  private actionSemanticState(state: Dict): Dict {
    return {
      ...semanticSnapshot(state, this.task?.apps || []),
      interaction: visibleInteractionContext(Boolean(staticSingleContract(this.task))),
      ...(this.allowAgentPosture ? { device: { posture: state.foldable?.posture,
        layout: state.foldable?.layout_id, multi_window: state.foldable?.multi_window } } : {}),
    };
  }

  /** Trusted action transport calls this, then records its return value once. */
  async performAgentPostureAction(action: 'fold' | 'unfold'): Promise<AgentAction> {
    await this.queue;
    if (!['fold', 'unfold'].includes(action))
      return { id: 'agent.invalid_posture', kind: 'invalid', params: {}, valid: false, terminal: false };
    if (!this.task || !this.allowAgentPosture)
      return { id: action, kind: action, params: {}, valid: false, terminal: false };
    const device = window.__FOLDAGENT__;
    if (typeof device?.[action] !== 'function')
      return { id: 'agent.posture_unavailable', kind: 'invalid', params: {}, valid: false, terminal: false };
    const before = device.getState();
    device[action]();
    await settle();
    const after = device.getState();
    const valid = after.posture === (action === 'fold' ? 'folded' : 'unfolded');
    return { id: action, kind: 'device', params: {
      posture_before: before.posture, posture_after: after.posture,
      layout_before: before.layout_id, layout_after: after.layout_id,
      changed: before.posture !== after.posture,
    }, valid, terminal: false };
  }

  recordAgentAction(action: AgentAction) {
    return this.enqueue(action);
  }

  // Called by the trusted screenshot transport only after pixels are captured.
  // A transient pre-transition DOM state is not evidence of delivered content.
  recordAgentObservation() {
    const single = singleAppContract(this.task);
    if (single && this.singleInitialReady && this.step > 0 && this.workflowActionEligible) {
      const seen = observeSingleApp(single, this.privateSnapshot(), this.initialState);
      this.anchors.single_candidate_visible ||= seen.candidate;
    }
    const workflow = workflowContract(this.task);
    if (!workflow) return;
    const seen = observeWorkflow(workflow, this.privateSnapshot());
    seen.sourceFacts.forEach((visible, index) => {
      if (visible) this.workflowFacts.add(index);
      if (visible && seen.split) this.workflowSplitFacts.add(index);
    });
    this.workflowSplitRead ||= this.workflowSplitFacts.size === workflow.source.facts.length;
    this.anchors.source_opened ||= seen.sourceFacts.some(Boolean);
    this.anchors.source_facts_verified ||= this.workflowFacts.size === workflow.source.facts.length
      && (!workflow.window || this.workflowSplitRead);
    this.workflowObservations.push({ step: this.step, source_facts: seen.sourceFacts, split: seen.split });
  }

  flush() { return this.queue.then(() => this.getReport()); }

  recordInvalidAction() { this.invalidActions += 1; }

  recordViolation(kind: 'real_world_side_effects' | 'forbidden_actions' | 'wrong_target_commits' | 'duplicate_commits') {
    this.violations[kind] += 1;
  }

  private enqueue(action: AgentAction) {
    const signature = JSON.stringify([action.id, action.params || {}]);
    this.seenAutomatic.set(signature, performance.now());
    this.queue = this.queue.then(() => this.afterAction(action));
    return this.queue;
  }

  private privateSnapshot(): Dict {
    const sim: Dict = clone(window.__SIM__?.getState?.() || { os: {}, apps: {} }) as Dict;
    const os = window.__OS__?.getState?.();
    const activeAppId = String(os?.activeAppId || '');
    const routes = Object.fromEntries((this.task?.apps || []).map(id => [id, workflowRoute(os, id,
      activityId => AppNavigatorRegistry.getActivityRoute(activityId)?.path,
      appId => window.__OS__?.getAppRoute(appId)?.path)]));
    const apps = sim.apps || {};
    const totalCommits = countCommits(apps);
    sim.telemetry = { ...this.violations, total_commits: totalCommits };
    sim.benchmark = { anchors: { [this.task?.pair_id || '']: clone(this.anchors) } };
    sim.runtime = { active_app_id: activeAppId, app_routes: routes };
    sim.foldable = window.__FOLDAGENT__?.getState?.() || {};
    const single = singleAppContract(this.task);
    if (single?.version === 3) sim.single_files = singleFileSnapshot(single);
    if (single && this.singleInitialReady) {
      const judgment = judgeSingleApp(this.initialState, sim, single);
      sim.single_app = { business_passed: judgment.business_passed,
        safety_passed: judgment.safety_passed && this.singleSafety.size === 0,
        safety_violations: [...this.singleSafety] };
    }
    const workflow = workflowContract(this.task);
    if (workflow) {
      const judgment = judgeWorkflow(this.initialState, sim, workflow);
      sim.workflow = { business_passed: judgment.business_passed,
        safety_passed: judgment.safety_passed && this.workflowSafety.size === 0,
        safety_violations: [...this.workflowSafety], source_read: this.anchors.source_facts_verified === true,
        split_read: this.workflowSplitRead, split_edit: this.workflowSplitEdit,
        split_present: workflowWindowMatches(workflow, sim),
        closed_source: this.workflowClosedSource,
      };
    }
    return sim;
  }

  private refreshAnchors(state: Dict) {
    if (!this.task) return;
    const single = singleAppContract(this.task);
    if (single && this.singleInitialReady) {
      if (!this.workflowActionEligible || this.step <= 0) return;
      const judgment = judgeSingleApp(this.initialState, state, single);
      for (const item of judgment.safety_checks) {
        if (!item.passed && !('latch' in item && item.latch === false)) this.singleSafety.add(item.name);
      }
      const seen = observeSingleApp(single, state, this.initialState);
      this.anchors.single_editor_ready ||= seen.editor && !judgment.business_passed;
      state.benchmark.anchors[this.task.pair_id] = clone(this.anchors);
      return;
    }
    const workflow = workflowContract(this.task);
    if (workflow) {
      if (!this.workflowActionEligible || this.step <= 0 || this.workflowObservedStep === this.step) return;
      this.workflowObservedStep = this.step;
      const seen = observeWorkflow(workflow, state);
      const sourceRead = this.workflowFacts.size === workflow.source.facts.length;
      const current = judgeWorkflow(this.initialState, state, workflow);
      for (const item of current.safety_checks) if (!item.passed) this.workflowSafety.add(item.name);
      this.anchors.source_facts_verified ||= sourceRead && (!workflow.window || this.workflowSplitRead);
      // Editor establishment is an observable GUI action; no gold-prefix test.
      this.anchors.target_entry_started ||= this.anchors.source_facts_verified && seen.targetContext && !current.business_passed;
      // Recovery additionally needs the identity promised by each task card.
      // This is current readiness, not a latched fact about an abandoned editor.
      this.anchors.target_recovery_ready = this.anchors.target_entry_started === true
        && seen.targetContext && state.runtime.active_app_id === workflow.target.app
        && !current.business_passed && workflowRecoveryIdentity(workflow, state, this.initialState) !== null;
      if (seen.split && seen.targetContext && state.runtime.active_app_id === workflow.target.app
        && !same(workflowAppContext(workflow.target.app, state.apps[workflow.target.app]),
          workflowAppContext(workflow.target.app, this.initialState.apps?.[workflow.target.app]))) this.workflowSplitEdit = true;
      state.benchmark.anchors[this.task.pair_id] = clone(this.anchors);
      return;
    }
    const sourceId = this.task.apps[0];
    const requirements = this.task.apps.flatMap(appId => {
      const probe = SOURCE_PROBES[appId];
      if (!probe) return [];
      const expectedIds = expectedSourceIds(this.task!.seed_contract, appId, probe[2]);
      return expectedIds.length ? [{ appId, probe, expectedIds }] : [];
    });
    for (const { appId, probe, expectedIds } of requirements) {
      const app = state.apps?.[appId] || {};
      const [, verifiedField] = probe;
      const stateVerifiedIds = Array.isArray(app[verifiedField]) ? app[verifiedField].map(String) : [];
      stateVerifiedIds.forEach((id: string) => this.verifiedSourceIds.add(`${appId}:${id}`));
      if (state.runtime?.active_app_id !== appId) continue;
      const visibleSourceIds = Array.from(document.querySelectorAll<HTMLElement>('[data-benchmark-source-id],[data-benchmark-page]'))
        .map(node => node.dataset.benchmarkSourceId || node.dataset.benchmarkPage || '');
      const visibleExpectedIds = visibleSourceIds.filter(id => expectedIds.includes(String(id))).map(String);
      visibleExpectedIds.forEach(id => this.openedSourceIds.add(`${appId}:${id}`));
      if (!EXPLICIT_VERIFY_APPS.has(appId)) {
        visibleExpectedIds.forEach(id => this.verifiedSourceIds.add(`${appId}:${id}`));
      }
    }
    let verified = requirements.length > 0 && requirements.every(({ appId, expectedIds }) =>
      expectedIds.every(id => this.verifiedSourceIds.has(`${appId}:${id}`)));
    const sourceRequirement = requirements.find(item => item.appId === sourceId);
    let sourceOpened = state.runtime?.active_app_id === sourceId;
    if (sourceId === 'tencent_meeting') {
      sourceOpened &&= isExpectedMeetingDetail(
        String(state.runtime?.app_routes?.[sourceId] || ''),
        this.task.seed_contract.meeting_id,
        state.apps?.[sourceId],
      );
      const factRequirements = meetingFactRequirements(
        String(state.runtime?.app_routes?.[sourceId] || ''), this.task.seed_contract.meeting_id,
        state.apps?.[sourceId], timestamp => {
          const date = fromTimestamp(timestamp);
          const strings = resolveAppStrings(meetingStrings, meetingStringsEn, getLocale());
          return { time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            date: formatMeetingFullDate(date, strings, { padMonth: true, padDay: true }) };
        },
      );
      if (sourceOpened && factRequirements) {
        for (const node of document.querySelectorAll<HTMLElement>('[data-app-id="tencent_meeting"] [data-benchmark-meeting-fact]')) {
          if (node.closest<HTMLElement>('[data-benchmark-meeting-id]')?.dataset.benchmarkMeetingId !== factRequirements.id) continue;
          const fact = factRequirements.facts.find(item => item.field === node.dataset.benchmarkMeetingFact);
          if (fact && node.textContent === fact.text
            && node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1
            && isDeliveredMenuText(node)) this.deliveredMeetingFacts.add(fact.key);
        }
      }
      verified = (requirements.length === 0 || verified)
        && Boolean(factRequirements && factRequirements.facts.every(fact => this.deliveredMeetingFacts.has(fact.key)));
    }
    if (sourceId === 'meituan_waimai') {
      const shops = resolveMeituanShops(state.apps?.[sourceId]?.shops);
      const route = String(state.runtime?.app_routes?.[sourceId] || '');
      sourceOpened &&= isExpectedShopRoute(
        route,
        expectedSourceIds(this.task.seed_contract, sourceId, 'shop_id'),
        shops.map(shop => shop.id),
      );
      const menu = menuFactRequirements(this.task.seed_contract, shops);
      if (sourceOpened && menu && /^\/shop\/[^/?#]+(?:[?#].*)?$/.test(route)) {
        for (const node of document.querySelectorAll<HTMLElement>('[data-app-id="meituan_waimai"] [data-benchmark-dish-id]')) {
          if (node.dataset.benchmarkShopId !== menu.shop.id) continue;
          const dish = menu.shop.dishes.find(item => item.id === node.dataset.benchmarkDishId);
          const name = node.querySelector<HTMLElement>('[data-benchmark-menu-name]');
          const price = node.querySelector<HTMLElement>('[data-benchmark-menu-price]');
          if (!dish || !name || !price || name.textContent !== dish.name
            || price.textContent !== `¥${dish.price.toFixed(2)}`
            || !isDeliveredMenuText(name) || !isDeliveredMenuText(price)) continue;
          const key = menuFactKey(menu.shop.id, dish);
          if (key && menu.keys.includes(key)) this.deliveredMenuFacts.add(key);
        }
      }
      verified = Boolean(menu && menu.keys.every(key => this.deliveredMenuFacts.has(key)))
        && requirements.every(({ appId, expectedIds }) =>
          expectedIds.every(id => this.verifiedSourceIds.has(`${appId}:${id}`)));
    }
    if (sourceRequirement) {
      const [selectedField] = sourceRequirement.probe;
      const selected = state.apps?.[sourceId]?.[selectedField];
      const selectedIds = (Array.isArray(selected) ? selected : selected == null ? [] : [selected]).map(String);
      sourceOpened &&= sourceRequirement.expectedIds.some(id =>
        selectedIds.includes(id) || this.openedSourceIds.has(`${sourceId}:${id}`));
    }
    let targetStarted = false;
    const targetIds = targetAppIds(this.task.apps, this.task.recovery?.app_id);
    for (const id of targetIds) {
      const app = state.apps?.[id] || {};
      const visibleTargetField = state.runtime?.active_app_id === id
        && Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-benchmark-field]')).some(node =>
          isVisibleField(node) && String(node.value ?? '').trim().length > 0
          && this.interactedTargetFields.has(`${id}:${node.dataset.benchmarkField || ''}`));
      const activeElement = document.activeElement;
      const focusedTargetField = state.runtime?.active_app_id === id
        && (activeElement instanceof HTMLInputElement
          || activeElement instanceof HTMLTextAreaElement
          || activeElement instanceof HTMLSelectElement)
        && activeElement.matches('[data-benchmark-field]')
        && isVisibleField(activeElement)
        && this.interactedTargetFields.has(`${id}:${activeElement.dataset.benchmarkField || ''}`);
      const draftProgress = hasDraftEntryProgress(app, this.initialState.apps?.[id] || {});
      const cartProgress = id === 'meituan_waimai' && hasCartEntryProgress(app, this.initialState.apps?.[id] || {});
      const newPersistedObject = ['notes', 'items', 'cards', 'events'].some(collection => {
        const current = app[collection];
        const initial = getPath(this.initialState, `apps.${id}.${collection}`);
        return Array.isArray(current) && current.some((item: any) =>
          (!Array.isArray(initial) || !initial.some((old: any) => same(old, item)))
          && Object.values(item || {}).some(value => typeof value === 'string' && value.trim().length > 0));
      });
      // Focusing a concrete benchmark field is the first observable entry
      // action and lets Recovery fire before an atomic whole-field type action
      // has already completed the goal. Merely opening an editor still does
      // not count as progress.
      targetStarted ||= Boolean(focusedTargetField || visibleTargetField || draftProgress || cartProgress || newPersistedObject);
    }
    const derived = {
      source_opened: sourceOpened,
      source_facts_verified: verified,
      target_entry_started: targetStarted,
      first_target_committed: hasTargetCommitProgress(state.apps || {}, this.initialState.apps || {},
        this.task.apps.length > 1 ? this.task.apps.slice(1) : targetIds),
    };
    for (const [key, value] of Object.entries(derived)) this.anchors[key] ||= Boolean(value);
    state.benchmark.anchors[this.task.pair_id] = clone(this.anchors);
  }

  private async afterAction(action: AgentAction) {
    if (!this.task) return;
    this.step += 1;
    const signature = JSON.stringify([action.id, action.params || {}]);
    const permittedPosture = this.allowAgentPosture && ['fold', 'unfold'].includes(action.id)
      && action.kind === 'device';
    const forbidden = !permittedPosture && (FORBIDDEN_POSTURE_ACTIONS.has(action.id) || FORBIDDEN_POSTURE_ACTIONS.has(String(action.kind || '')));
    const valid = action.valid !== false && !forbidden;
    this.workflowActionEligible = valid && !action.terminal && !['agent.wait', 'agent.terminate', 'agent.invalid', 'fold', 'unfold'].includes(action.id);
    if (!valid) this.invalidActions += 1;
    if (forbidden) this.violations.forbidden_actions += 1;
    await settle();
    // React routing can complete after the two-frame DOM settle. Sampling the
    // old home route loses a natural pre-query checkpoint before later scrolling.
    await settleShopNavigation({ ...action, valid }, {
      read: () => ({ appId: window.__OS__?.getState?.().activeAppId,
        path: window.__OS__?.getAppRoute('meituan_waimai')?.path }),
      nextFrame: settle, now: () => performance.now(),
    });
    await refreshSingleFiles(staticSingleContract(this.task));
    let state = this.privateSnapshot();
    const workflow = workflowContract(this.task);
    if (workflow?.window?.close_source && this.workflowPreviousBusiness && action.id === 'agent.swipe'
      && this.workflowSplitEdit && state.foldable.multi_window.mode === 'fullscreen'
      && !(state.os?.tasks ?? []).some((task: any) => task.rootAppId === workflow.source.app)
      && state.runtime.active_app_id === workflow.target.app) this.workflowClosedSource = true;
    const interactedField = String(action.params?.benchmark_field || '');
    if (interactedField && state.runtime?.active_app_id) {
      this.interactedTargetFields.add(`${state.runtime.active_app_id}:${interactedField}`);
    }
    this.refreshAnchors(state);
    const preStateHash = await sha256(this.lastSemanticState);
    const currentSemanticState = this.actionSemanticState(state);
    const postStateHash = await sha256(currentSemanticState);
    const effectful = !same(this.lastSemanticState, currentSemanticState);
    if (signature === this.lastSignature && !effectful) this.repeatedActions += 1;
    this.lastSignature = signature;
    const afterEventIds = this.evidence.filter(event => this.step > event.trigger_step).map(event => event.event_id);
    this.actions.push({ ...clone(action), step: this.step, after_transition: afterEventIds.length > 0, after_event_ids: afterEventIds, pre_state_hash: preStateHash, post_state_hash: postStateHash, effectful, valid });

    for (const event of this.task.event_plan) {
      if (this.fired.has(event.event_id) || this.timedOut.has(event.event_id)) continue;
      // Consecutive agent actions may trigger successive events; the break below
      // still limits each action to one event. Do not trigger after goal completion.
      if (workflow && (!this.workflowActionEligible || judgeWorkflow(this.initialState, state, workflow).business_passed)) continue;
      const single = singleAppContract(this.task);
      if (single && (!this.workflowActionEligible || judgeSingleApp(this.initialState, state, single).business_passed)) continue;
      const ready = event.trigger.all.every(predicate => same(getPath(state, predicate.path), predicate.equals));
      if (!ready) {
        if (this.step >= event.trigger.max_wait_steps) this.timedOut.add(event.event_id);
        continue;
      }
      const before = window.__FOLDAGENT__?.getState?.();
      if (!before || before.posture !== devicePosture(event.transition.from_posture)) continue;
      const triggerHash = await sha256(evidenceSnapshot(state, this.task.apps));
      const recoveryApp = event.fault?.app_id;
      const requireIdentity = !!workflow && this.task.recovery?.required_context.includes('target_identity') === true;
      const recoveryActivity = recoveryApp ? workflowActivity(state.os, recoveryApp) : null;
      const identityBefore = requireIdentity ? workflowRecoveryIdentity(workflow!, state, this.initialState) : null;
      const targetForm = !!workflow && this.task.recovery?.capture_strategy === 'persisted_plus_target_form_hash';
      const retainedIds = recoveryApp ? retainedAppIds(this.task) : [];
      // Capture the real pre-fault DOM before posture change / app recreation.
      const contextBefore = recoveryApp ? {
        persisted: workflow ? workflowAppContext(recoveryApp, state.apps?.[recoveryApp]) : persistedContext(state.apps?.[recoveryApp]),
        // Empty controls carry no entered user context and may legitimately
        // move off-screen after a form-factor transition.
        form: (targetForm ? targetFormContext(recoveryApp) : visibleFormContext()).filter(item => String(item.value).trim().length > 0),
        ...(retainedIds.length ? { retained: captureRetainedApps(state.apps, retainedIds) } : {}),
      } : null;
      if (before.posture !== devicePosture(event.transition.to_posture)) window.__FOLDAGENT__?.setPosture(devicePosture(event.transition.to_posture), {
        event: {
          event_id: event.event_id,
          controller: 'benchmark',
          trigger_step: this.step,
          trigger_state_hash: triggerHash,
          posture_before: before.posture,
          posture_after: devicePosture(event.transition.to_posture),
          layout_before: before.layout_id,
          layout_after: layoutForPosture(event.transition.to_posture),
        },
      });
      if (event.fault?.type === 'recreate_app') {
        const originalPanes = before.multi_window.mode === 'split'
          ? [before.multi_window.primary_task_id, before.multi_window.secondary_task_id].map(id => window.__OS__?.getState().tasks.find(task => task.taskId === id)?.rootAppId) : null;
        const route = state.runtime.app_routes[event.fault.app_id];
        if (recoveryActivity && recoveryActivity.task.rootAppId !== event.fault.app_id) {
          // A Contacts-hosted SMS editor is an Activity, not a standalone SMS
          // Task. Remove only that Activity and replay its real launch Intent.
          if (!recoveryActivity.activity.intent) throw Error('Recovery Activity lacks its launch Intent');
          window.__OS__?.finishActivity();
          await settle();
          await window.__OS__?.startActivity(clone(recoveryActivity.activity.intent));
          await settle();
          const recreated = workflowActivity(window.__OS__?.getState(), event.fault.app_id);
          if (recreated && route) {
            AppNavigatorRegistry.getActivity(recreated.activity.activityId)?.navigate(route, { replace: true });
          }
        } else {
          window.__OS__?.closeApp(event.fault.app_id);
          await settle();
          await window.__OS__?.openApp(event.fault.app_id, route);
        }
        if (workflow && originalPanes?.every(Boolean)) {
          await settle();
          const tasks = window.__OS__!.getState().tasks;
          const ids = originalPanes.map(app => tasks.find(task => task.rootAppId === app)?.taskId);
          if (ids.every(Boolean)) window.__FOLDAGENT__?.setMultiWindow('split', ids[0]!, ids[1]!,
            before.multi_window.divider_ratio, null, 0.5,
            before.multi_window.unfolded_split_orientation ?? before.multi_window.split_orientation);
        }
      }
      await settle();
      const after = window.__FOLDAGENT__?.getState?.();
      const contextAfter = recoveryApp && contextBefore
        ? await waitForRecoveryContext(recoveryApp, contextBefore, 3000, !!workflow, targetForm)
        : null;
      const postState = this.privateSnapshot();
      const recreatedActivity = recoveryApp ? workflowActivity(postState.os, recoveryApp) : null;
      const identityAfter = requireIdentity ? workflowRecoveryIdentity(workflow!, postState, this.initialState) : null;
      const persistedBeforeHash = contextBefore ? await sha256(contextBefore.persisted) : null;
      const persistedAfterHash = contextAfter ? await sha256(contextAfter.persisted) : null;
      const recoveredForm = contextBefore && contextAfter
        ? compareRecoveredForm(contextBefore.form, contextAfter.form) : null;
      const contextChecks = recoveryApp && contextBefore && contextAfter ? [
        { name: 'persisted_state', passed: persistedBeforeHash === persistedAfterHash, before: persistedBeforeHash, after: persistedAfterHash },
        { name: targetForm ? 'target_form_fields' : 'visible_form_fields', passed: recoveredForm?.fieldsPreserved === true, before: contextBefore.form.map((item: any) => item.key), after: contextAfter.form.map((item: any) => item.key) },
        { name: targetForm ? 'target_form_values' : 'visible_form_values', passed: recoveredForm?.valuesPreserved === true, before: contextBefore.form, after: contextAfter.form },
        ...(requireIdentity ? [
          { name: 'target_identity', passed: identityBefore !== null && same(identityBefore, identityAfter), before: identityBefore, after: identityAfter },
          { name: 'target_activity_recreated', passed: !!recoveryActivity && !!recreatedActivity
            && recoveryActivity.activity.activityId !== recreatedActivity.activity.activityId,
            before: recoveryActivity?.activity.activityId, after: recreatedActivity?.activity.activityId },
          ...(recoveryActivity && recoveryActivity.task.rootAppId !== recoveryApp ? [{
            name: 'host_task_and_caller_preserved', passed: !!recreatedActivity
              && recoveryActivity.task.taskId === recreatedActivity.task.taskId
              && same(recoveryActivity.task.stack.slice(0, -1), recreatedActivity.task.stack.slice(0, -1)),
            before: { task_id: recoveryActivity.task.taskId, stack: recoveryActivity.task.stack.slice(0, -1) },
            after: recreatedActivity ? { task_id: recreatedActivity.task.taskId, stack: recreatedActivity.task.stack.slice(0, -1) } : null,
          }] : []),
        ] : []),
        ...await Promise.all(retainedIds.map(async id => ({ name: `retained_app:${id}`,
          passed: retainedContextEqual(contextBefore.retained?.[id], contextAfter.retained?.[id]),
          before: await sha256(contextBefore.retained?.[id]), after: await sha256(contextAfter.retained?.[id]) }))),
      ] : [];
      this.evidence.push({
        event_id: event.event_id, controller: 'benchmark', trigger_step: this.step,
        trigger_state_hash: triggerHash, posture_before: before.posture,
        posture_after: after?.posture || '', layout_before: before.layout_id,
        layout_after: after?.layout_id || '', pre_state: state, post_state: postState,
        transition_duration_steps: event.transition.duration_steps,
        ...(event.fault ? { recovery_deadline_step: this.step + Number(this.task.recovery?.max_recovery_steps || 0) } : {}),
        ...(recoveryApp ? {
          context_hash_before: await sha256(contextBefore), context_hash_after: await sha256(contextAfter),
          context_retained: contextChecks.length > 0 && contextChecks.every(check => check.passed),
          context_checks: contextChecks,
        } : {}),
      });
      this.fired.add(event.event_id);
      break;
    }
    this.lastSemanticState = clone(this.actionSemanticState(this.privateSnapshot()));
    if (workflow) this.workflowPreviousBusiness = judgeWorkflow(this.initialState, this.privateSnapshot(), workflow).business_passed;
    if (this.goalSatisfiedStep == null && this.evidence.some(event => event.recovery_deadline_step != null)) {
      const current = this.privateSnapshot();
      if (this.businessGoalSatisfied(current)) this.goalSatisfiedStep = this.step;
    }
  }

  private checkRule(rule: Rule, state: Dict) {
    const actual = getPath(state, rule.path);
    if (rule.op === 'eq') return same(actual, rule.value);
    if (rule.op === 'neq') return !same(actual, rule.value);
    if (rule.op === 'contains') return typeof actual === 'string' ? actual.includes(String(rule.value)) : Array.isArray(actual) && actual.some(item => same(item, rule.value));
    if (rule.op === 'contains_object') return Array.isArray(actual) && actual.some(item => objectContains(item, rule.value));
    if (rule.op === 'count_eq') return (actual?.length ?? -1) === rule.value;
    if (rule.op === 'unchanged') return same(actual, getPath(this.initialState, rule.path));
    if (rule.op === 'delta_eq') {
      const initial = Number(getPath(this.initialState, rule.path) ?? 0);
      return Number.isFinite(Number(actual)) && Number(actual) - initial === Number(rule.value);
    }
    return false;
  }

  private businessJudgment(state: Dict) {
    if (!this.task) return null;
    const single = singleAppContract(this.task);
    if (single && this.singleInitialReady) return judgeSingleApp(this.initialState, state, single);
    const workflow = workflowContract(this.task);
    if (workflow) return judgeWorkflow(this.initialState, state, workflow);
    const contract = getPriceNoteTaskContract(this.task);
    return contract ? judgePriceNote(this.initialState.apps, state.apps, contract) : null;
  }

  private businessGoalSatisfied(state: Dict) {
    if (!this.task || !this.task.evaluator.success_all.every(rule => this.checkRule(rule, state))) return false;
    const business = this.businessJudgment(state);
    return business === null || business.passed === true;
  }

  private expectedCommitDelta() {
    const rules = this.task?.evaluator.success_all || [];
    const totalRule = rules.find(rule => rule.path === 'telemetry.total_commits' && (rule.op === 'eq' || rule.op === 'delta_eq'));
    if (totalRule) return Number(totalRule.value) - (totalRule.op === 'eq' ? Number(getPath(this.initialState, totalRule.path) || 0) : 0);
    return rules.filter(rule => /\.(created_count|save_count)$/.test(rule.path) && (rule.op === 'eq' || rule.op === 'delta_eq'))
      .reduce((sum, rule) => sum + Number(rule.value) - (rule.op === 'eq' ? Number(getPath(this.initialState, rule.path) || 0) : 0), 0);
  }

  getReport() {
    let state = this.privateSnapshot();
    if (this.task) this.refreshAnchors(state);
    const commitDelta = Number(state.telemetry?.total_commits || 0) - Number(getPath(this.initialState, 'telemetry.total_commits') || 0);
    const workflow = workflowContract(this.task);
    if (!workflow && !staticSingleContract(this.task)) this.violations.duplicate_commits = Math.max(this.violations.duplicate_commits, commitDelta - this.expectedCommitDelta(), 0);
    state = this.privateSnapshot();
    const reportViolations = effectiveViolationCounts(
      this.violations,
      workflow || staticSingleContract(this.task) ? 0 : inferWrongTargetCommits(this.task, this.initialState, state),
    );
    state.telemetry = { ...state.telemetry, ...reportViolations };
    if (this.task) this.refreshAnchors(state);
    const targetChecks = (this.task?.evaluator.success_all || []).map(rule => ({ rule, passed: this.checkRule(rule, state) }));
    const safetyChecks = (this.task?.evaluator.safety_all || []).map(rule => ({ rule, passed: this.checkRule(rule, state) }));
    const business = this.businessJudgment(state);
    const requiredEvents = this.task?.evaluator.must_have_events || [];
    const eventCoverage = requiredEvents.every(id => this.fired.has(id));
    const postTransitionByEvent = Object.fromEntries(this.evidence.map(event => [event.event_id,
      this.actions.some(action => action.step > event.trigger_step && action.valid && action.effectful),
    ]));
    const postTransitionAction = !this.task?.evaluator.require_post_transition_action
      || requiredEvents.every(id => postTransitionByEvent[id] === true);
    const recoveryEvent = this.evidence.find(event => event.recovery_deadline_step != null);
    const eventContextChecks = recoveryEvent?.context_checks || [];
    const finalContextChecks = (this.task?.recovery?.context_rules || []).map(rule => ({ name: `final:${rule.path}`, rule, passed: this.checkRule(rule, state) }));
    const contextChecks = [...eventContextChecks, ...finalContextChecks];
    const recoveryCompletionStep = recoveryEvent && this.goalSatisfiedStep != null && this.goalSatisfiedStep > recoveryEvent.trigger_step ? this.goalSatisfiedStep : null;
    // Missing proven completion cannot attribute a budget failure to an
    // unresolved business expression. Context/event violations still dominate.
    const recoveryWithinBudget = recoveryEvent && recoveryCompletionStep == null && business?.passed === null ? null
      : !recoveryEvent || (recoveryCompletionStep != null && recoveryCompletionStep <= Number(recoveryEvent.recovery_deadline_step));
    const recoveryPassed = !this.task?.recovery || combineEvidenceChecks([
      eventContextChecks.length > 0, contextChecks.every(check => check.passed),
      retainedAppIds(this.task).every(id => eventContextChecks.some(check => check.name === `retained_app:${id}` && check.passed === true)),
      recoveryEvent?.context_retained === true, recoveryWithinBudget, this.violations.duplicate_commits === 0,
    ]);
    const interactionQuality = !this.task || (this.invalidActions <= this.task.evaluator.max_invalid_actions && this.repeatedActions <= this.task.evaluator.max_repeated_actions);
    return {
      task_id: this.task?.id || null, pair_id: this.task?.pair_id || null,
      condition: this.task?.condition || null,
      agent_posture_control: {
        enabled: this.allowAgentPosture,
        actions: this.actions.filter(action => action.valid && action.kind === 'device' && ['fold', 'unfold'].includes(action.id)).length,
        changes: this.actions.filter(action => action.valid && action.kind === 'device' && ['fold', 'unfold'].includes(action.id) && action.params?.changed === true).length,
      },
      step: this.step, passed: combineEvidenceChecks([targetChecks.every(x => x.passed),
        safetyChecks.every(x => x.passed), eventCoverage, postTransitionAction, interactionQuality,
        recoveryPassed, business === null ? true : business.passed]),
      ...(business ? { business_judgment: business } : {}),
      target_checks: targetChecks, safety_checks: safetyChecks, event_coverage: eventCoverage,
      required_event_ids: clone(requiredEvents),
      post_transition_action: postTransitionAction, post_transition_by_event: postTransitionByEvent, interaction_quality: interactionQuality,
      invalid_actions: this.invalidActions, repeated_actions: this.repeatedActions,
      violation_counts: clone(reportViolations),
      seed_applied: this.seedApplied, initial_state_hash: this.initialStateHash,
      episode: clone(this.episodeMetadata),
      seed_checks: clone(this.seedChecks),
      requested_window: clone(this.requestedWindow), effective_window: clone(this.effectiveWindow),
      recovery: this.task?.recovery ? { passed: recoveryPassed, context_retained: recoveryEvent?.context_retained === true, context_checks: contextChecks, within_budget: recoveryWithinBudget, completion_step: recoveryCompletionStep, recovery_steps: recoveryEvent && recoveryCompletionStep != null ? recoveryCompletionStep - recoveryEvent.trigger_step : null } : null,
      fired_events: [...this.fired], timed_out_events: [...this.timedOut], evidence: clone(this.evidence), action_trace: clone(this.actions), final_state: state,
      ...(workflowContract(this.task) ? { delivered_observations: clone(this.workflowObservations) } : {}),
    };
  }
}

export const FoldAgentBenchmark = new FoldAgentBenchmarkController();

declare global {
  interface Window {
    __FOLDAGENT_BENCH__?: FoldAgentBenchmarkController;
  }
}

if (typeof window !== 'undefined') window.__FOLDAGENT_BENCH__ = FoldAgentBenchmark;
