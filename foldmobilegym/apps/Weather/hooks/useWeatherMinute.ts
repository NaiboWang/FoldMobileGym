import { useSyncExternalStore } from 'react';
import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from '../../../os/BroadcastBus';
import * as TimeService from '../../../os/TimeService';

// TimeService is shared by the simulator. The forecast display only needs
// minute precision, so snapshots are stable and no per-card polling is needed.
const getMinute = () => Math.floor(TimeService.now() / 60_000) * 60_000;
const subscribe = (notify: () => void) => {
  const offSet = BroadcastBus.registerReceiver(ACTION_TIME_SET, notify);
  const offTick = BroadcastBus.registerReceiver(ACTION_TIME_TICK, notify);
  return () => { offSet(); offTick(); };
};

export const useWeatherMinute = () => useSyncExternalStore(subscribe, getMinute, getMinute);
