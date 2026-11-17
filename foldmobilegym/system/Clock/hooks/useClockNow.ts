import { useEffect, useState } from 'react';
import { fromTimestamp, now } from '../../../os/TimeService';
import { subscribeClockTime } from './clockTimeSubscription';

export function useClockNow(): Date {
  const [timestamp, setTimestamp] = useState(now);
  useEffect(() => subscribeClockTime(setTimestamp), []);
  return fromTimestamp(timestamp);
}
