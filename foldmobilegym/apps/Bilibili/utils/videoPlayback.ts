export interface PlaybackSnapshot { position: number; duration: number; playing: boolean }

/** Cover-only simulator timeline. No claim of decoded video/audio. */
export function createVideoPlayback(duration: number, readNow: () => number) {
  const total = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  let position = 0, playing = total > 0, active = false, anchor = readNow();
  let snapshot: PlaybackSnapshot = { position, duration: total, playing };
  const listeners = new Set<() => void>();
  const capture = () => {
    const now = readNow();
    if (active && playing) position = Math.min(total, position + Math.max(0, now - anchor) / 1000);
    anchor = now;
    if (total <= 0 || position >= total) playing = false;
  };
  const publish = () => {
    if (snapshot.position === position && snapshot.playing === playing) return;
    snapshot = { position, duration: total, playing };
    listeners.forEach(listener => listener());
  };
  const play = () => { capture(); if (total > 0) { if (position >= total) position = 0; playing = true; } publish(); };
  const pause = () => { capture(); playing = false; publish(); };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    tick: () => { const wasRunning = active && playing; capture(); const ended = wasRunning && total > 0 && position >= total; publish(); return ended; },
    setActive: (next: boolean) => { capture(); active = next; publish(); },
    play, pause,
    toggle: () => { if (playing) pause(); else play(); },
    seek: (value: number) => {
      if (!Number.isFinite(value)) return;
      capture(); position = Math.min(total, Math.max(0, value));
      if (position >= total) playing = false;
      publish();
    },
  };
}
export type VideoPlayback = ReturnType<typeof createVideoPlayback>;

export function parseVideoDuration(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, raw) : 0;
  if (!raw) return 0;
  const parts = raw.trim().split(':');
  if (parts.length > 3 || parts.some(part => !/^\d+$/.test(part))) return 0;
  return parts.reduce((value, part) => value * 60 + Number(part), 0);
}
export function formatVideoTime(seconds: number): string {
  const total = Math.floor(Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
  return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function seekPosition(clientX: number, left: number, width: number, duration: number) {
  if (![clientX, left, width, duration].every(Number.isFinite) || width <= 0 || duration <= 0) return null;
  return Math.max(0, Math.min(1, (clientX - left) / width)) * duration;
}
