import React, { useEffect, useRef, useState } from 'react';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVideoPlayback } from '../hooks/useVideoPlayback';
import { formatVideoTime, seekPosition } from '../utils/videoPlayback';
import { useAppStrings } from '../../../os/useAppStrings';
import { useLocale } from '../locale';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcPlay, IcPause, IcNavBack } from '../res/icons';

export const VideoPlayer: React.FC<{
  videoId: string; cover?: string; title?: string; duration: number;
  fullscreen: boolean; compact?: boolean; tab: 'intro' | 'comment'; fullscreenProps: React.HTMLAttributes<HTMLButtonElement>; onNaturalEnd?: () => void; onPlaybackInteraction?: () => void;
}> = ({ videoId, cover, title, duration, fullscreen, compact = false, tab, fullscreenProps, onNaturalEnd, onPlaybackInteraction }) => {
  const s = useAppStrings(strings, stringsEn, useLocale());
  const { bindTap, bindBack } = useBilibiliGestures();
  const { session, position, playing } = useVideoPlayback(videoId, duration, onNaturalEnd);
  const [controls, setControls] = useState(true), [seeking, setSeeking] = useState(false);
  const [controlEpoch, setControlEpoch] = useState(0);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const owner = useRef<{ id: number; target: HTMLElement; position: number; playing: boolean } | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const showControls = () => { setControls(true); setControlEpoch(value => value + 1); };
  useEffect(() => {
    if (!controls || !playing || seeking || compact) return;
    const timer = setTimeout(() => setControls(false), 3000);
    return () => clearTimeout(timer);
  }, [controls, playing, seeking, controlEpoch, compact]);
  const release = () => {
    const active = owner.current; owner.current = null;
    if (active?.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
    return active;
  };
  useEffect(() => () => {
    const active = release();
    if (active) { session.seek(active.position); if (active.playing) session.play(); }
  }, [session]);
  useEffect(() => {
    if (!compact) return;
    const active = release();
    if (active) {
      session.seek(active.position);
      if (active.playing) session.play();
      setSeeking(false);
    }
  }, [compact, session]);
  const seekAt = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    const value = rect && seekPosition(clientX, rect.left, rect.width, duration);
    if (value != null) session.seek(value);
  };
  const down = (event: React.PointerEvent<HTMLDivElement>) => {
    if (compact || !event.isPrimary || event.button !== 0 || owner.current || duration <= 0) return;
    event.preventDefault(); event.stopPropagation();
    onPlaybackInteraction?.();
    const wasPlaying = session.getSnapshot().playing;
    session.pause();
    owner.current = { id: event.pointerId, target: event.currentTarget, position: session.getSnapshot().position, playing: wasPlaying };
    // Synthetic SIM_INPUT pointers may not own a native browser pointer capture.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* handlers still enforce pointer identity */ }
    setSeeking(true); showControls(); seekAt(event.clientX);
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (owner.current?.id !== event.pointerId) return;
    event.stopPropagation(); seekAt(event.clientX);
  };
  const up = (event: React.PointerEvent<HTMLDivElement>) => {
    if (owner.current?.id !== event.pointerId) return;
    event.stopPropagation(); seekAt(event.clientX);
    const active = release(); setSeeking(false); showControls();
    if (active?.playing && session.getSnapshot().position < duration) session.play();
  };
  const cancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (owner.current?.id !== event.pointerId) return;
    const active = release(); setSeeking(false); showControls();
    if (active) { session.seek(active.position); if (active.playing) session.play(); }
  };
  const toggle = () => { onPlaybackInteraction?.(); session.toggle(); showControls(); };
  const playProps = fullscreen
    ? tab === 'intro'
      ? bindTap({ kind: 'action', id: 'video.player.fullIntro.play.toggle' }, { onTrigger: toggle })
      : bindTap({ kind: 'action', id: 'video.player.fullComment.play.toggle' }, { onTrigger: toggle })
    : tab === 'intro'
      ? bindTap({ kind: 'action', id: 'video.player.intro.play.toggle' }, { onTrigger: toggle })
      : bindTap({ kind: 'action', id: 'video.player.comment.play.toggle' }, { onTrigger: toggle });
  // Shared input chrome receives a literal action configuration for each declared state.
  const seekAction = fullscreen
    ? tab === 'intro' ? { id: 'video.player.fullIntro.seek.input' } : { id: 'video.player.fullComment.seek.input' }
    : tab === 'intro' ? { id: 'video.player.intro.seek.input' } : { id: 'video.player.comment.seek.input' };
  const percent = duration > 0 ? position / duration * 100 : 0;
  return (
    <div data-bili-player data-video-id={videoId} data-fullscreen={fullscreen} data-compact={compact} data-playing={playing}
      className={`bili-video-player ${fullscreen ? 'bili-video-player-fullscreen' : ''}`}>
      {cover && failedCover !== cover
        ? <img src={cover} alt={title ?? ''} referrerPolicy="no-referrer" draggable={false}
            className="bili-player-cover absolute inset-0 w-full h-full object-contain" onError={() => setFailedCover(cover)} />
        : <div role="status" className="bili-player-cover absolute inset-0 flex items-center justify-center text-white/60 text-sm">{s.player_cover_unavailable}</div>}
      <button className="bili-player-surface-toggle absolute inset-0 w-full h-full z-10" aria-label={s.player_controls_toggle} onClick={() => { if (controls) setControls(false); else showControls(); }} />
      <div className={`bili-player-source-label absolute right-2 text-[10px] text-white/80 bg-black/60 px-2 py-1 rounded pointer-events-none z-20 ${fullscreen ? 'top-12' : 'top-2'}`}>{s.player_simulated}</div>
      <div inert={!controls && !compact && playing} aria-hidden={!controls && !compact && playing} className={`bili-player-controls absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 ${controls || compact || !playing ? '' : 'invisible'}`}>
        <div className="flex items-center gap-2.5 text-white">
          <button {...playProps} aria-label={playing ? s.player_pause : s.player_play} aria-pressed={playing} disabled={duration <= 0}
            className="bili-player-play w-8 h-8 shrink-0 flex items-center justify-center disabled:opacity-40">
            {playing ? <IcPause size={22} fill="currentColor" strokeWidth={0} /> : <IcPlay size={22} fill="currentColor" strokeWidth={0} />}
            <span className="bili-player-compact-label">{playing ? s.player_compact_pause : s.player_compact_resume}</span>
          </button>
          <span className="bili-player-compact-source">{s.player_no_source}</span>
          <span data-bili-time className="text-[11px] tabular-nums shrink-0">{formatVideoTime(position)}/{formatVideoTime(duration)}</span>
          <div ref={track} role="slider" tabIndex={0} aria-label={s.player_seek} aria-valuemin={0} aria-valuemax={duration}
            aria-valuenow={position} aria-valuetext={formatVideoTime(position)} aria-disabled={duration <= 0}
            data-action={seekAction.id} data-action-type="input" data-action-params={JSON.stringify({ value: position })}
            className="bili-player-seek flex-1 min-w-0 h-6 flex items-center cursor-pointer touch-none"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
            onKeyDown={event => {
              if (compact) return;
              const value = event.key === 'Home' ? 0 : event.key === 'End' ? duration
                : event.key === 'ArrowLeft' ? position - 5 : event.key === 'ArrowRight' ? position + 5 : null;
              if (value == null) return;
              event.preventDefault(); onPlaybackInteraction?.(); session.seek(value); showControls();
            }}>
            <div className="w-full h-1 relative rounded-full bg-white/30">
              <div className="absolute inset-y-0 left-0 bg-app-primary rounded-full" style={{ width: `${percent}%` }} />
              <div className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${percent}%` }} />
            </div>
          </div>
          <button {...(fullscreen ? bindBack() : fullscreenProps)} aria-label={fullscreen ? s.player_exit_fullscreen : s.player_fullscreen}
            className="w-8 h-8 shrink-0 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              {fullscreen ? <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5" /> : <path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5" />}
            </svg>
          </button>
        </div>
      </div>
      <button {...bindBack()} aria-label={fullscreen ? s.player_exit_fullscreen : s.player_back}
        className={`absolute left-2 w-8 h-8 bg-black/50 rounded-full text-white flex items-center justify-center z-30 ${fullscreen ? 'top-12' : 'top-2'}`}>
        <IcNavBack size={20} />
      </button>
    </div>
  );
};
