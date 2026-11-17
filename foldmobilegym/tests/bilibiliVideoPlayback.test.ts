import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createVideoPlayback, parseVideoDuration, formatVideoTime, seekPosition } from '../apps/Bilibili/utils/videoPlayback';
import { getPlaybackEntryKey, getVideoFullscreenFallback, isVideoFullscreen } from '../apps/Bilibili/utils/playerNavigation';
import { normalizeBilibiliEntryRoute } from '../apps/Bilibili/utils/entryRoute';
import { NAVIGATION_DECLARATION } from '../apps/Bilibili/navigation.declaration';
function fixture(duration = 100) {
  let clock = 0; const session = createVideoPlayback(duration, () => clock);
  return { session, advance: (ms: number) => { clock += ms; session.tick(); } };
}
describe('Bilibili cover-only timeline sessions', () => {
  it('uses a stable cached snapshot and starts only while observed', () => {
    const { session, advance } = fixture(); const initial = session.getSnapshot();
    expect(session.getSnapshot()).toBe(initial); advance(2000); expect(session.getSnapshot().position).toBe(0);
    session.setActive(true); advance(2250); expect(session.getSnapshot()).toEqual({ position:2.25, duration:100, playing:true });
  });
  it('pauses exactly, ignores hidden route time, then resumes its own position', () => {
    const { session, advance }=fixture(); session.setActive(true); advance(1500); session.pause(); advance(5000);
    expect(session.getSnapshot().position).toBe(1.5); session.play(); advance(500); expect(session.getSnapshot().position).toBe(2);
    session.setActive(false); advance(8000); expect(session.getSnapshot().position).toBe(2);
    session.setActive(true); advance(1000); expect(session.getSnapshot().position).toBe(3);
  });
  it('seeks/reanchors without retaining an obsolete tick origin', () => {
    const { session, advance }=fixture(); session.setActive(true); advance(1000); session.seek(30); advance(500);
    expect(session.getSnapshot().position).toBe(30.5); session.pause(); session.seek(8); advance(2000);
    expect(session.getSnapshot()).toMatchObject({position:8,playing:false});
  });
  it('independent videos cannot inherit a sought position or running anchor', () => {
    const a=fixture(704),b=fixture(93); a.session.setActive(true);a.session.seek(21);a.advance(500);a.session.setActive(false);
    b.session.setActive(true);b.advance(750);expect(b.session.getSnapshot().position).toBe(.75);expect(a.session.getSnapshot().position).toBe(21.5);
  });
  it('stops at duration and replays from zero only when asked', () => {
    const {session,advance}=fixture(2);session.setActive(true);advance(2500);
    expect(session.getSnapshot()).toEqual({position:2,duration:2,playing:false});advance(5000);expect(session.getSnapshot().position).toBe(2);
    session.play();expect(session.getSnapshot()).toMatchObject({position:0,playing:true});advance(500);expect(session.getSnapshot().position).toBe(.5);
  });
  it.each([0,-4,NaN,Infinity])('does not invent a running duration from %s', duration => {
    const {session,advance}=fixture(duration);session.setActive(true);session.play();advance(1000);
    expect(session.getSnapshot()).toEqual({position:0,duration:0,playing:false});
  });
  it('clamps seek bounds, ignores invalid positions and backwards physical time', () => {
    const {session,advance}=fixture();session.setActive(true);advance(1000);advance(-300);
    expect(session.getSnapshot().position).toBe(1);session.seek(NaN);expect(session.getSnapshot().position).toBe(1);
    session.seek(-20);expect(session.getSnapshot().position).toBe(0);session.seek(200);expect(session.getSnapshot().position).toBe(100);
  });
  it('unsubscribes listeners without stale callbacks or record writes', () => {
    const {session,advance}=fixture();const callback=vi.fn(),off=session.subscribe(callback);session.setActive(true);advance(1000);
    expect(callback).toHaveBeenCalledTimes(1);off();advance(1000);expect(callback).toHaveBeenCalledTimes(1);
  });
  it.each([['11:44',704],['01:33',93],['1:02:03',3723],['42',42],[24,24],['',0],['abc',0],['1:2:x',0],['-1:00',0]])('parses %s without accessing system time', (input,expected) => {
    expect(parseVideoDuration(input)).toBe(expected);
  });
  it('formats durations and maps CSS-zoom viewport coordinates', () => {
    expect(formatVideoTime(3723.5)).toBe('1:02:03');expect(formatVideoTime(93)).toBe('01:33');expect(formatVideoTime(NaN)).toBe('00:00');
    expect(seekPosition(250,100,300,90)).toBe(45);expect(seekPosition(-100,100,300,90)).toBe(0);expect(seekPosition(800,100,300,90)).toBe(90);
    expect(seekPosition(4,0,0,90)).toBeNull();expect(seekPosition(NaN,0,300,90)).toBeNull();
  });
});
describe('Bilibili fullscreen/history truth', () => {
  it('normalizes cold video entry without altering unrelated or explicit tabs', () => {
    expect(normalizeBilibiliEntryRoute('/video/BV1')).toBe('/video/BV1?tab=intro');
    expect(normalizeBilibiliEntryRoute('/video/BV1?view=fullscreen')).toBe('/video/BV1?view=fullscreen&tab=intro');
    expect(normalizeBilibiliEntryRoute('/video/BV1?tab=comment')).toBe('/video/BV1?tab=comment');
    expect(normalizeBilibiliEntryRoute('/settings')).toBe('/settings');
  });
  it('keeps same-entry sessions across tab replace/fullscreen push', () => {
    expect(getPlaybackEntryKey({key:'new',state:{bilibiliPlaybackEntry:'original'}})).toBe('original');
    expect(getPlaybackEntryKey({key:'actual',state:{bilibiliPlaybackEntry:2}})).toBe('actual');
  });
  it('closes a real fullscreen history entry, reconstructing only a missing parent', () => {
    const current={pathname:'/video/BV1',search:'?tab=comment&view=fullscreen'};
    expect(getVideoFullscreenFallback(current,{pathname:'/video/BV1',search:'?tab=comment'})).toBeNull();
    expect(getVideoFullscreenFallback(current,{pathname:'/video/BV1',search:'?tab=intro'})).toBe('/video/BV1?tab=comment');
    expect(getVideoFullscreenFallback(current)).toBe('/video/BV1?tab=comment');
    expect(getVideoFullscreenFallback({pathname:'/video/BV1',search:'?tab=intro'})).toBeNull();
    expect(isVideoFullscreen('/settings','?view=fullscreen')).toBe(false);
  });
  it('declares two fullscreen destinations and unique real control actions', () => {
    const route=NAVIGATION_DECLARATION.routes.find(route=>route.path==='/video/:bvid')!;
    expect(route.uiStates.filter(s=>'view' in s.search&&s.search.view==='fullscreen').map(s=>s.search)).toEqual([{tab:'intro',view:'fullscreen'},{tab:'comment',view:'fullscreen'}]);
    expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='video.player.fullscreen.open')).toMatchObject({mode:'push',to:'/video/:bvid',preserveParams:['tab']});
    const playerIds=route.uiStates.flatMap(s=>'actions' in s?s.actions.map(a=>a.id).filter(id=>id.startsWith('video.player.')):[]);
    expect(playerIds).toHaveLength(8);expect(new Set(playerIds).size).toBe(8);
  });
  it('rejects missing identities instead of silently rendering another video', () => {
    const detail=readFileSync(new URL('../apps/Bilibili/pages/VideoDetailPage.tsx',import.meta.url),'utf8');
    expect(detail).not.toContain('video = VIDEO_DATA[0]');expect(detail).toContain('if (!video) return');
    expect(detail).toContain('inert={fullscreen || commentPanelOpen}');expect(detail).not.toContain('setCurrentSec');
    const player=readFileSync(new URL('../apps/Bilibili/components/VideoPlayer.tsx',import.meta.url),'utf8');
    expect(player).toContain('owner.current?.id !== event.pointerId');expect(player).toContain('session.seek(active.position)');
    const memory=readFileSync(new URL('../apps/Bilibili/context/VideoPlaybackContext.tsx',import.meta.url),'utf8');
    expect(memory).toContain('new Map<string, VideoPlayback>()');
    expect(memory).toContain('useLayoutEffect'); expect(memory).not.toContain('localStorage');
    const hook=readFileSync(new URL('../apps/Bilibili/hooks/useVideoPlayback.ts',import.meta.url),'utf8');
    expect(hook).toContain('clearInterval(timer)'); expect(hook).toContain('session.setActive(false)');
    expect(player).toContain('s.player_simulated');expect(player).not.toContain('requestFullscreen');
  });
});
