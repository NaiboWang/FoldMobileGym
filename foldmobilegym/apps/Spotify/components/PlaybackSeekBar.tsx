import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { useSpotifyStore } from '../state';
import { formatSpotifyPosition, spotifySeekPosition, type SpotifyPlaybackAnchor } from '../playback';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

type PointerOwner = { id: number; element: HTMLDivElement; trackId: string; anchor: SpotifyPlaybackAnchor | null;
  locationKey: string; left: number; width: number; value: number };

/** Preview follows one pointer; only a valid release commits an identity-bound seek. */
export function PlaybackSeekBar({ trackId, positionMs, durationMs, durationText }: {
  trackId: string; positionMs: number; durationMs: number; durationText: string;
}) {
  const s = useSpotifyStrings(), location = useLocation(), activityId = useActivityId();
  const anchor = useSpotifyStore(state => state.playback);
  const track = useRef<HTMLDivElement>(null), owner = useRef<PointerOwner | null>(null);
  const liveKey = useRef(location.key); liveKey.current = location.key;
  const [preview, setPreview] = useState<number | null>(null);
  const release = useCallback(() => {
    const active = owner.current; owner.current = null;
    if (active) {
      try { if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id); } catch { /* detached/synthetic pointer */ }
    }
  }, []);
  const cancel = useCallback(() => { release(); setPreview(null); }, [release]);
  useEffect(() => () => release(), [release]);
  useLayoutEffect(() => { cancel(); }, [trackId, anchor, location.key, cancel]);
  useLayoutEffect(() => {
    if (!track.current) return;
    const observer = new ResizeObserver(() => {
      const active = owner.current, rect = track.current?.getBoundingClientRect();
      if (active && (!rect || Math.abs(rect.width - active.width) > .5 || Math.abs(rect.left - active.left) > .5)) cancel();
    });
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [cancel]);
  const isCurrent = (key: string) => {
    const node = track.current, os = window.__OS__?.getState();
    const top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    return Boolean(node?.isConnected && !node.closest('[inert]') && node.getBoundingClientRect().width > 0
      && !os?.isLauncherVisible && !os?.isRecentsVisible && os?.activeAppId === 'spotify'
      && top?.activityId === activityId && liveKey.current === key && useSpotifyStore.getState().currentTrack?.id === trackId);
  };
  const owns = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = owner.current;
    if (!active || active.id !== event.pointerId) return false;
    const rect = track.current?.getBoundingClientRect();
    if (!isCurrent(active.locationKey) || useSpotifyStore.getState().playback !== active.anchor
      || !rect || Math.abs(rect.width - active.width) > .5 || Math.abs(rect.left - active.left) > .5) { cancel(); return false; }
    return true;
  };
  const seekAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = track.current?.getBoundingClientRect();
    const value = rect ? spotifySeekPosition(event.clientX, rect.left, rect.width, durationMs) : null;
    if (value !== null && owner.current) { owner.current.value = value; setPreview(value); }
  };
  const down = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || owner.current || durationMs <= 0 || !isCurrent(location.key)) return;
    event.preventDefault(); event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    owner.current = { id: event.pointerId, element: event.currentTarget, trackId, anchor,
      locationKey: location.key, left: rect.left, width: rect.width, value: positionMs };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* SIM_INPUT still has explicit pointer ownership */ }
    event.currentTarget.focus({ preventScroll: true }); seekAt(event);
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => { if (owns(event)) { event.stopPropagation(); seekAt(event); } };
  const up = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!owns(event)) return;
    event.preventDefault(); event.stopPropagation(); seekAt(event);
    const active = owner.current; release(); setPreview(null);
    if (active) useSpotifyStore.getState().seekPlayback(active.value, active.trackId);
  };
  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey || !isCurrent(location.key) || durationMs <= 0) return;
    const value = event.key === 'Home' ? 0 : event.key === 'End' ? durationMs
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? positionMs - 5000
      : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? positionMs + 5000 : null;
    if (value === null) return;
    event.preventDefault(); event.stopPropagation(); cancel(); useSpotifyStore.getState().seekPlayback(value, trackId);
  };
  const value = preview ?? positionMs, percent = durationMs > 0 ? Math.max(0, Math.min(100, value / durationMs * 100)) : 0;
  const rail = <div className="spotify-seek-rail"><div className="spotify-seek-fill" style={{ width: `${percent}%` }} />
    <div className="spotify-seek-thumb" style={{ left: `${percent}%` }} /></div>;
  return <>
    {durationMs > 0 ? <div ref={track} role="slider" tabIndex={0} aria-label={s.player_progress}
      aria-valuemin={0} aria-valuemax={durationMs} aria-valuenow={value} aria-valuetext={formatSpotifyPosition(value)}
      data-action="player.progress.input" data-action-type="input" data-action-params={JSON.stringify({ value, trackId })}
      className="spotify-player-seek" onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onPointerCancel={event => { if (owner.current?.id === event.pointerId) cancel(); }}
      onLostPointerCapture={event => { if (owner.current?.id === event.pointerId) cancel(); }} onKeyDown={keyDown}>
      {rail}
    </div> : <div className="spotify-player-seek" aria-hidden>{rail}</div>}
    <div className="flex justify-between text-xs text-gray-400 font-medium">
      <span data-testid="spotify-player-elapsed">{formatSpotifyPosition(value)}</span><span>{durationText}</span>
    </div>
  </>;
}
