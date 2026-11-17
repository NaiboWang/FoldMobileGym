import { createVolatileOsStore } from '../../os/createOsStore';
import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from '../../os/BroadcastBus';
import * as TimeService from '../../os/TimeService';
import {
  EMPTY_STOPWATCH, observeStopwatch, pauseStopwatch, recordStopwatchLap,
  resetStopwatch, startStopwatch, type StopwatchState,
} from './stopwatchModel';

export const useStopwatchRuntime = createVolatileOsStore<StopwatchState>(
  'clock_stopwatch', EMPTY_STOPWATCH, { useImmer: false },
);

let timer: ReturnType<typeof setInterval> | null = null;
let offSet: (() => void) | null = null;
let offTick: (() => void) | null = null;
let normalizingReset = false;

function publish(next: StopwatchState) {
  if (next !== useStopwatchRuntime.getState()) useStopwatchRuntime.setState(next, true);
}

function refresh() {
  const current = useStopwatchRuntime.getState();
  if (current.phase === 'running') publish(observeStopwatch(current, TimeService.now()));
}

function stopObserving() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  offSet?.();
  offTick?.();
  offSet = null;
  offTick = null;
}

useStopwatchRuntime.subscribe((next, previous) => {
  if (!normalizingReset && next.phase === 'idle' && next.elapsedMs === 0
    && next.anchorMs === null && next.laps.length === 0 && next.lapSequence === 0
    && next.lapCount === 0 && next.runId === 0 && next.revision === 0
    && previous.revision !== 0) {
    normalizingReset = true;
    publish({ ...EMPTY_STOPWATCH, revision: previous.revision + 1 });
    normalizingReset = false;
    return;
  }

  if (next.phase === 'running' && timer === null) {
    timer = setInterval(refresh, 30);
    offSet = BroadcastBus.registerReceiver(ACTION_TIME_SET, refresh);
    offTick = BroadcastBus.registerReceiver(ACTION_TIME_TICK, refresh);
  } else if (next.phase !== 'running' && timer !== null) {
    stopObserving();
  }
});

function owns(revision: number) {
  return useStopwatchRuntime.getState().revision === revision;
}

export const stopwatchRuntime = {
  start(revision: number) {
    if (!owns(revision)) return;
    publish(startStopwatch(useStopwatchRuntime.getState(), TimeService.now()));
  },
  pause(revision: number) {
    if (!owns(revision)) return;
    publish(pauseStopwatch(useStopwatchRuntime.getState(), TimeService.now()));
  },
  lap(revision: number) {
    if (!owns(revision)) return;
    publish(recordStopwatchLap(useStopwatchRuntime.getState(), TimeService.now()));
  },
  reset(revision: number) {
    if (!owns(revision)) return;
    publish(resetStopwatch(useStopwatchRuntime.getState()));
  },
};
