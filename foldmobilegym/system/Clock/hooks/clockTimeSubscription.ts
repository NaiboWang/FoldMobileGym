import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from '../../../os/BroadcastBus';
import { now } from '../../../os/TimeService';

/** Live UI observation only: never publishes or edits an alarm record. */
export function subscribeClockTime(update: (timestamp: number) => void): () => void {
  let active = true;
  const refresh = () => { if (active) update(now()); };
  const offSet = BroadcastBus.registerReceiver(ACTION_TIME_SET, refresh);
  const offTick = BroadcastBus.registerReceiver(ACTION_TIME_TICK, refresh);
  // Poll seconds for elapsed countdowns; broadcasts also acknowledge frozen
  // time jumps immediately. React bails out on unchanged frozen timestamps.
  const timer = setInterval(refresh, 1000);
  refresh(); // Close the initial-render/subscription gap.
  return () => { active = false; clearInterval(timer); offSet(); offTick(); };
}
