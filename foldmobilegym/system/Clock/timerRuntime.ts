import { createVolatileOsStore } from '../../os/createOsStore';
import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from '../../os/BroadcastBus';
import * as TimeService from '../../os/TimeService';
import NotificationService from '../../os/NotificationService';
import { createBrowserTimerSound } from '../../os/BrowserTimerSound';
import { getLocale } from '../../os/locale';
import { resolveAppStrings } from '../../os/useAppStrings';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import {
  EMPTY_COUNTDOWN, observeCountdown, beginCountdown, pauseCountdown, resumeCountdown, type Countdown,
} from './countdownModel';

// UI Tasks may be destroyed independently. Browser reload/OS reset stops this volatile service;
// the original persistent alarm/city records are never touched.
export const useTimerRuntime = createVolatileOsStore<Countdown>('clock_timer', EMPTY_COUNTDOWN, { useImmer: false });
const sound = createBrowserTimerSound();
const epoch = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
let sequence = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let offSet: (() => void) | null = null;
let offTick: (() => void) | null = null;
const owned = (revision: number) => useTimerRuntime.getState().revision === revision;
function publish(next: Countdown) {
  if (next !== useTimerRuntime.getState()) useTimerRuntime.setState(next, true);
}
function refresh() {
  publish(observeCountdown(useTimerRuntime.getState(), TimeService.now()));
}
function synchronize(next: Countdown, previous: Countdown) {
  // Registry reset clones EMPTY_COUNTDOWN. Revoke pre-reset commands instead of reusing
  // revision zero, including queued handlers whose UI entry has not disappeared yet.
  if (next.phase === 'setup' && next.runId === 0 && next.revision === 0) {
    publish({ ...next, revision: previous.revision + 1 });
    next = useTimerRuntime.getState();
  }
  if (next.phase === 'running' && timer === null) {
    timer = setInterval(refresh, 200);
    offSet = BroadcastBus.registerReceiver(ACTION_TIME_SET, refresh);
    offTick = BroadcastBus.registerReceiver(ACTION_TIME_TICK, refresh);
  }
  if (next.phase !== 'running' && timer !== null) {
    clearInterval(timer); timer = null;
    offSet?.(); offTick?.(); offSet = null; offTick = null;
  }
  if (previous.notificationId && previous.notificationId !== next.notificationId) {
    NotificationService.dismiss(previous.notificationId);
  }
  if (next.phase !== 'finished') sound.stop();
  if (next.phase === 'setup') sound.dispose();
  if (next.phase === 'finished' && previous.phase !== 'finished' && next.notificationId) {
    const s = resolveAppStrings(strings, stringsEn, getLocale());
    // Latch first: even a reentrant notification observer cannot post expiry twice.
    const notification = NotificationService.push({
      id: next.notificationId, appId: 'clock', title: s.timer_finished_title,
      body: s.timer_finished_body, importance: 'high', route: '/timer', autoCancel: false,
    });
    const current = useTimerRuntime.getState();
    if (notification.id === current.notificationId && current.phase === 'finished') sound.play(next.notificationId);
  }
}
useTimerRuntime.subscribe(synchronize);
export const timerRuntime = {
  primeSound: () => sound.prime(),
  start(seconds: number, revision: number) {
    if (!owned(revision)) return;
    const current = useTimerRuntime.getState();
    const next = beginCountdown(current, seconds, TimeService.now(), sequence + 1);
    if (next === current) return;
    sequence++;
    publish({ ...next, notificationId: `clock.timer.${epoch}.${sequence}` });
  },
  pause(revision: number) {
    if (owned(revision)) publish(pauseCountdown(useTimerRuntime.getState(), TimeService.now()));
  },
  resume(revision: number) {
    if (owned(revision)) publish(resumeCountdown(useTimerRuntime.getState(), TimeService.now()));
  },
  stop(revision: number) {
    if (!owned(revision)) return;
    const current = useTimerRuntime.getState();
    publish({ ...EMPTY_COUNTDOWN, runId: current.runId, revision: current.revision + 1 });
  },
};
