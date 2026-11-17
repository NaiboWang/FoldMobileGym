import { routeGetPreference } from './managers/registry';

export type BrowserToneId = 'classic' | 'soft' | 'bright';
const TONE_PROFILES: Record<BrowserToneId, { type: OscillatorType; frequency: number }> = {
  classic: { type: 'sine', frequency: 880 },
  soft: { type: 'sine', frequency: 587 },
  bright: { type: 'triangle', frequency: 1046 },
};

/** Simulator browser-tone profile, not a measured native ringtone envelope. */
export const BROWSER_ALARM_GRADUAL_SECONDS = 30;

/** Browser feedback only. No native alarm, autoplay permission or audible success is fabricated. */
export function createBrowserTimerSound(options?: { gradualVolume?: () => boolean }) {
  let context: AudioContext | null = null;
  let loop: ReturnType<typeof setInterval> | null = null;
  let active: string | null = null;
  let revision = 0;
  const voices = new Map<OscillatorNode, GainNode>();
  const allowed = () => routeGetPreference('do_not_disturb') !== true && routeGetPreference('silent') !== true;
  const disconnect = (voice: OscillatorNode, gain: GainNode) => {
    voices.delete(voice);
    try { voice.disconnect(); } catch { /* Device/context may already be closed. */ }
    try { gain.disconnect(); } catch { /* Device/context may already be closed. */ }
  };
  const stop = () => {
    active = null;
    if (loop !== null) clearInterval(loop);
    loop = null;
    for (const [voice, gain] of voices) {
      try { voice.stop(); } catch { /* Already ended. */ }
      disconnect(voice, gain);
    }
    voices.clear();
  };
  const prime = async () => {
    if (typeof AudioContext === 'undefined') return false;
    const own = revision;
    try {
      const candidate = context ?? (context = new AudioContext());
      if (candidate.state === 'suspended') await candidate.resume();
      return own === revision && context === candidate && candidate.state === 'running';
    } catch { return false; }
  };
  const play = (id: string, tone: BrowserToneId = 'classic') => {
    stop();
    if (!context || context.state !== 'running' || !allowed()) return false;
    let gradual: boolean;
    try { gradual = options?.gradualVolume?.() === true; } catch { return false; }
    const startedAt = context.currentTime;
    active = id;
    const pulse = () => {
      if (active !== id || !context || context.state !== 'running') return true;
      if (!allowed()) return true;
      const raw = routeGetPreference('volume_alarm');
      const volume = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) / 100 : 0.5;
      if (!volume) return true;
      let oscillator: OscillatorNode | null = null;
      let gain: GainNode | null = null;
      try {
        oscillator = context.createOscillator(); gain = context.createGain();
        const time = context.currentTime;
        const fraction = gradual ? Math.max(0.05, Math.min(1, (time - startedAt) / BROWSER_ALARM_GRADUAL_SECONDS)) : 1;
        const peak = volume * 0.16 * fraction;
        const profile = TONE_PROFILES[tone] ?? TONE_PROFILES.classic;
        oscillator.type = profile.type; oscillator.frequency.value = profile.frequency;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peak, time + 0.015);
        gain.gain.setValueAtTime(peak, time + 0.12);
        gain.gain.linearRampToValueAtTime(0, time + 0.16);
        oscillator.connect(gain); gain.connect(context.destination);
        voices.set(oscillator, gain);
        const voice = oscillator, envelope = gain;
        oscillator.onended = () => disconnect(voice, envelope);
        oscillator.start(time); oscillator.stop(time + 0.17);
        return true;
      } catch {
        if (oscillator && gain) disconnect(oscillator, gain);
        else if (oscillator) { try { oscillator.disconnect(); } catch { /* Already closed. */ } }
        stop();
        return false;
      }
    };
    if (!pulse()) return false;
    loop = setInterval(pulse, 750);
    return true;
  };
  const dispose = () => {
    revision++;
    stop();
    const previous = context; context = null;
    try { void previous?.close().catch(() => {}); } catch { /* Capability may have been revoked. */ }
  };
  return { prime, play, stop, dispose };
}
