import { getTracker } from '@/os/utils/memoryHistoryTracker';

/** Rewind before the same synchronous navigation call pushes a replacement flow. */
export function rewindSelectionHistory(navigator: unknown, steps: number, sourceKey?: string): boolean {
  const memory = navigator as { index?: number; location?: { key?: string }; go?: (delta: number) => void } | null;
  if (!memory || typeof memory.go !== 'function' || !Number.isSafeInteger(steps) || steps < 1 ||
      typeof memory.index !== 'number' || !Number.isSafeInteger(memory.index) || memory.index < steps) return false;
  // The first rewind changes the memory location immediately, before React
  // removes the old menu. Reject another call from that now-stale binding.
  if (sourceKey !== undefined && memory.location?.key !== sourceKey) return false;
  const targetIndex = memory.index - steps;
  memory.go(-steps);
  const tracker = getTracker(memory as object);
  if (tracker) {
    tracker.index = targetIndex;
    tracker.stack.length = targetIndex + 1;
  }
  return true;
}
