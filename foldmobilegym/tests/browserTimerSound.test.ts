import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const prefs = vi.hoisted(() => ({ values: {} as Record<string, unknown> }));
vi.mock('../os/managers/registry', () => ({ routeGetPreference: (key: string) => prefs.values[key] }));
import { createBrowserTimerSound } from '../os/BrowserTimerSound';
const contexts: FakeContext[] = [];
class FakeContext {
  state = 'running'; currentTime = 10; destination = {};
  voices: ReturnType<FakeContext['createOscillator']>[] = [];
  gains: ReturnType<FakeContext['createGain']>[] = [];
  fail = false;
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  constructor() { contexts.push(this); }
  createOscillator() {
    if (this.fail) throw new Error('Audio device unavailable');
    const node = { type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as null | (() => void) };
    this.voices.push(node); return node;
  }
  createGain() {
    const node = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    this.gains.push(node); return node;
  }
}
const sounds: ReturnType<typeof createBrowserTimerSound>[] = [];
function sound(options?: Parameters<typeof createBrowserTimerSound>[0]) { const value = createBrowserTimerSound(options); sounds.push(value); return value; }
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => { vi.useFakeTimers(); contexts.length = 0; prefs.values = { volume_alarm: 50 }; vi.stubGlobal('AudioContext', FakeContext); });
afterEach(() => { sounds.splice(0).forEach(value => value.dispose()); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('owned browser timer audio', () => {
  it('gradually reaches the current alarm volume without changing the legacy envelope', async () => {
    const value = sound({ gradualVolume: () => true }); await value.prime(); value.play('gradual');
    expect(contexts[0].gains[0].gain.linearRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(0.004, 10);
    contexts[0].currentTime = 25; vi.advanceTimersByTime(750);
    expect(contexts[0].gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.04, 25.015);
    contexts[0].currentTime = 40; vi.advanceTimersByTime(750);
    expect(contexts[0].gains[2].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.08, 40.015);
    contexts[0].currentTime = 100; vi.advanceTimersByTime(750);
    expect(contexts[0].gains[3].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.08, 100.015);
  });
  it('captures the preference for the current alert and rereads it for the next alert', async () => {
    let gradual = true; const getter = vi.fn(() => gradual), value = sound({ gradualVolume: getter });
    await value.prime(); value.play('one'); gradual = false; contexts[0].currentTime = 25; vi.advanceTimersByTime(750);
    expect(getter).toHaveBeenCalledOnce(); expect(contexts[0].gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.04, 25.015);
    value.play('two'); expect(getter).toHaveBeenCalledTimes(2);
    expect(contexts[0].gains[2].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.08, 25.015);
    expect(vi.getTimerCount()).toBe(1);
  });
  it.each(['silent', 'do_not_disturb'])('gradual mode never bypasses %s', async key => {
    const value = sound({ gradualVolume: () => true }); await value.prime(); prefs.values[key] = true;
    expect(value.play('one')).toBe(false); expect(contexts[0].gains).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('gradual pulses respect live volume and preserve zero-volume silence', async () => {
    const value = sound({ gradualVolume: () => true }); await value.prime(); value.play('one');
    prefs.values.volume_alarm = 0; contexts[0].currentTime = 25; vi.advanceTimersByTime(750); expect(contexts[0].gains).toHaveLength(1);
    prefs.values.volume_alarm = 100; vi.advanceTimersByTime(750);
    expect(contexts[0].gains[1].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.08, 25.015);
  });
  it('a failed preference reader cannot crash or retain the previous alert loop', async () => {
    let fail = false; const value = sound({ gradualVolume: () => { if (fail) throw new Error('Unavailable'); return true; } });
    await value.prime(); value.play('one'); fail = true; expect(value.play('two')).toBe(false);
    expect(vi.getTimerCount()).toBe(0); expect(contexts[0].voices[0].disconnect).toHaveBeenCalled();
  });
  it('requires priming rather than claiming sound from an unavailable context', async () => {
    const value = sound(); expect(value.play('one')).toBe(false); expect(await value.prime()).toBe(true);
    expect(value.play('one')).toBe(true); expect(contexts[0].voices).toHaveLength(1);
    expect(contexts[0].gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.08, 10.015);
  });
  it.each([
    ['classic', 'sine', 880],
    ['soft', 'sine', 587],
    ['bright', 'triangle', 1046],
  ] as const)('plays the selected synthesized browser profile: %s', async (tone, type, frequency) => {
    const value = sound(); await value.prime();
    expect(value.play(`tone-${tone}`, tone)).toBe(true);
    expect(contexts[0].voices[0]).toMatchObject({ type, frequency: { value: frequency } });
  });
  it('clears pulses and disconnects voices even if onended never arrives', async () => {
    const value = sound(); await value.prime(); value.play('one'); const context = contexts[0];
    vi.advanceTimersByTime(750); expect(context.voices).toHaveLength(2); value.stop();
    for (const voice of context.voices) expect(voice.disconnect).toHaveBeenCalled();
    for (const gain of context.gains) expect(gain.disconnect).toHaveBeenCalled();
    vi.advanceTimersByTime(3000); expect(context.voices).toHaveLength(2); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['silent', 'do_not_disturb'])('suppresses new audio under %s', async key => {
    const value = sound(); await value.prime(); prefs.values[key] = true;
    expect(value.play('one')).toBe(false); expect(contexts[0].voices).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('rechecks volume and DND for each pulse of the current alert', async () => {
    const value = sound(); await value.prime(); prefs.values.volume_alarm = 0; value.play('one');
    expect(contexts[0].voices).toHaveLength(0); prefs.values.volume_alarm = 100; vi.advanceTimersByTime(750);
    expect(contexts[0].voices).toHaveLength(1); prefs.values.do_not_disturb = true; vi.advanceTimersByTime(1500);
    expect(contexts[0].voices).toHaveLength(1);
  });
  it('does not let an old suspended resume claim a later context', async () => {
    const old = deferred(); const value = sound();
    // Create one context, then suspend it before priming again.
    await value.prime(); const first = contexts[0]; first.state = 'suspended';
    first.resume.mockImplementation(async () => { await old.promise; first.state = 'running'; });
    const pending = value.prime(); value.dispose(); expect(await value.prime()).toBe(true);
    old.resolve(); expect(await pending).toBe(false); expect(first.close).toHaveBeenCalledTimes(1);
  });
  it('reports unsupported and denied resume without rejecting the UI action', async () => {
    vi.stubGlobal('AudioContext', undefined); const value = sound(); expect(await value.prime()).toBe(false);
    vi.stubGlobal('AudioContext', FakeContext); await value.prime(); contexts[0].state = 'suspended';
    contexts[0].resume.mockRejectedValue(new Error('NotAllowedError')); expect(await value.prime()).toBe(false);
  });
  it('audio-device failure cannot crash timer completion or leave a pulse loop', async () => {
    const value = sound(); await value.prime(); contexts[0].fail = true;
    expect(value.play('one')).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it('replacement alerts stop and disconnect the prior run', async () => {
    const value = sound(); await value.prime(); value.play('one'); const first = contexts[0].voices[0];
    value.play('two'); expect(first.disconnect).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(1);
    value.dispose(); value.dispose(); expect(contexts[0].close).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
});
