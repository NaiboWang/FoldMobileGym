import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const audio = vi.hoisted(() => ({ options: undefined as undefined | { gradualVolume?: () => boolean } }));
vi.mock('../os/BrowserTimerSound', () => ({ createBrowserTimerSound: (options?: typeof audio.options) => {
  audio.options = options; return { prime: vi.fn(async () => true), play: vi.fn(() => true), dispose: vi.fn() };
} }));
import { useClockStore } from '../system/Clock/state';
import { CLOCK_CONFIG } from '../system/Clock/data';
import AlarmManagerService from '../os/AlarmManagerService';
import '../system/Clock/alarmRuntime';
const original = useClockStore.getState();
beforeEach(() => useClockStore.setState({ ...original, settings: { gradualVolume: false } }));
afterEach(() => { useClockStore.setState(original, true); vi.restoreAllMocks(); });
describe('Clock settings data and alarm-audio wiring', () => {
  it('adds only the new documented setting default', () => {
    expect(CLOCK_CONFIG.settings).toEqual({ gradualVolume: false });
    expect(useClockStore.getState().alarms).toEqual(CLOCK_CONFIG.alarms);
    expect(useClockStore.getState().selectedCityIds).toEqual(CLOCK_CONFIG.selectedCityIds);
  });
  it('updates the settings domain without changing alarms/cities or rescheduling', () => {
    const before = useClockStore.getState(), publish = vi.spyOn(AlarmManagerService, 'setAlarmClocksFor');
    before.updateSettings({ gradualVolume: true }); const after = useClockStore.getState();
    expect(after.settings).toEqual({ gradualVolume: true }); expect(after.alarms).toBe(before.alarms);
    expect(after.selectedCityIds).toBe(before.selectedCityIds); expect(publish).not.toHaveBeenCalled();
    expect(CLOCK_CONFIG.settings.gradualVolume).toBe(false);
  });
  it('retains false rather than interpreting it as an absent patch', () => {
    useClockStore.getState().updateSettings({ gradualVolume: true }); useClockStore.getState().updateSettings({ gradualVolume: false });
    expect(useClockStore.getState().settings?.gradualVolume).toBe(false);
  });
  it('supports legacy persisted environments without the optional domain', () => {
    useClockStore.setState({ settings: undefined }); expect(audio.options?.gradualVolume?.()).toBe(false);
    useClockStore.getState().updateSettings({ gradualVolume: true }); expect(audio.options?.gradualVolume?.()).toBe(true);
  });
  it('rejects empty, malformed and unknown settings writes', () => {
    for (const patch of [{}, null, { gradualVolume: 'true' }, { unknown: true }]) {
      const before = useClockStore.getState(); before.updateSettings(patch as never); expect(useClockStore.getState()).toBe(before);
    }
  });
  it('supplies the actual current preference to the owned alarm sound factory', () => {
    expect(audio.options?.gradualVolume?.()).toBe(false); useClockStore.getState().updateSettings({ gradualVolume: true });
    expect(audio.options?.gradualVolume?.()).toBe(true); useClockStore.getState().updateSettings({ gradualVolume: false });
    expect(audio.options?.gradualVolume?.()).toBe(false);
  });
});
