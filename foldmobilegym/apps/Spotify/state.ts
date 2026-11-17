import BroadcastBus, { ACTION_BOOT_COMPLETED, ACTION_TIME_SET, ACTION_TIME_TICK } from '../../os/BroadcastBus';
import { createAppStoreWithActions, memoSelector, writePersistedAppState } from '../../os/createAppStore';
import MediaSessionService, { type ActiveMediaSession } from '../../os/MediaSessionService';
import { SPOTIFY_CONFIG } from './data';
import type { SpotifyTrack, SpotifyPlaylist, SpotifyArtist, PlaySource, PlayHistoryEntry, SearchHistoryEntry } from './types';
import * as TimeService from '../../os/TimeService';
import { playbackAnchor, parseSpotifyDurationMs, resolveSpotifyPlayback, restoreSpotifyPlayback, samePlaybackAnchor, synchronizeSpotifyPlayback, type SpotifyPlaybackAnchor } from './playback';
import { createSpotifyPlaybackRuntime } from './playbackRuntime';

let localSeq = 0;
function nextId(prefix: string): string {
  localSeq += 1;
  return `${prefix}_${TimeService.now()}_${localSeq}`;
}

// ── Types ──────────────────────────────────────────────────────────

export interface SpotifySettings {
  dataSaver: {
    saverMode: number;
    downloadCellular: boolean;
    downloadAudioOnly: boolean;
    streamAudioOnly: boolean;
  };
  mediaQuality: {
    wifiQuality: string;
    cellQuality: string;
    downloadQuality: string;
  };
  playback: {
    gapless: boolean;
    automix: boolean;
    crossfade: number;
    autoplay: boolean;
    monoAudio: boolean;
    broadcast: boolean;
    sleepTimer: number;
    sleepTimerDeadlineMs?: number;
    sleepFade: boolean;
    lyricsEnabled: boolean;
  };
  privacy: {
    shareActivity: boolean;
    privateSession: boolean;
    recentArtists: boolean;
    publicPlaylists: boolean;
    profilePlaylists: boolean;
  };
  contentDisplay: {
    reduceMotion: boolean;
    canvas: boolean;
    explicit: boolean;
    unavailable: boolean;
    createBtn: boolean;
  };
  appsDevices: {
    voiceAssistant: boolean;
    connectControl: boolean;
    localVisibility: boolean;
    localFiles: boolean;
  };
}

export interface SpotifyState {
  currentUser: any;
  accounts: any[];
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  playback: SpotifyPlaybackAnchor | null;
  shuffle: boolean;
  repeat: 'off' | 'context' | 'track';
  queue: SpotifyTrack[];
  recentPlays: SpotifyTrack[];
  likedSongs: SpotifyTrack[];
  followedArtists: string[];
  customPlaylists: (SpotifyPlaylist | SpotifyArtist)[];
  playHistory: PlayHistoryEntry[];
  settings: SpotifySettings;
  pendingPlaylistTrack: SpotifyTrack | null;
  searchHistory: SearchHistoryEntry[];
  _temp: {
    queueToast: SpotifyTrack | null;
    likedToast: SpotifyTrack | null;
  };
}

export interface SpotifyActions {
  playTrack: (track: SpotifyTrack, source?: PlaySource) => void;
  setQueueWithTracks: (tracks: SpotifyTrack[], startIndex?: number, source?: PlaySource) => void;
  togglePlay: (trackId?: string) => void;
  seekPlayback: (positionMs: number, trackId?: string) => void;
  syncPlayback: (now: number, previousNow?: number) => void;
  checkpointPlayback: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: (track: SpotifyTrack) => void;
  toggleFollowArtist: (artistName: string) => void;
  addToQueue: (track: SpotifyTrack) => void;
  createPlaylist: (name: string, initialTrack?: SpotifyTrack | null) => SpotifyPlaylist;
  skipToNext: () => void;
  skipToPrevious: () => void;
  updateTrackCover: (trackId: string, newCover: string) => void;
  addAccount: (name: string) => void;
  switchAccount: (userId: string) => void;
  addTrackToPlaylist: (name: string, track: SpotifyTrack) => void;
  removeTrackFromPlaylist: (name: string, trackId: string) => void;
  updateSettings: <K extends keyof SpotifySettings>(category: K, patch: Partial<SpotifySettings[K]>) => void;
  setSleepTimer: (minutes: number) => void;
  setSearchResults: (query: string, tracks: SpotifyTrack[]) => void;
  showQueueToast: (track: SpotifyTrack) => void;
  clearQueueToast: () => void;
  clearLikedToast: () => void;
}

// ── Initial State ──────────────────────────────────────────────────

const configUser = SPOTIFY_CONFIG.user as { id: string; name: string; initial: string; color: string };

const initialState: SpotifyState = {
  currentUser: configUser,
  accounts: [configUser],
  currentTrack: SPOTIFY_CONFIG.recentPlays.length > 0
    ? SPOTIFY_CONFIG.recentPlays[0]
    : SPOTIFY_CONFIG.recommendedTracks.length > 0
      ? SPOTIFY_CONFIG.recommendedTracks[0]
      : null,
  isPlaying: false,
  playback: null,
  shuffle: false,
  repeat: 'off',
  queue: SPOTIFY_CONFIG.recommendedTracks,
  recentPlays: SPOTIFY_CONFIG.recentPlays as SpotifyTrack[],
  likedSongs: (SPOTIFY_CONFIG.likedSongs ?? []) as SpotifyTrack[],
  followedArtists: (() => {
    const fromConfig = (SPOTIFY_CONFIG.followedArtists ?? []) as string[];
    if (fromConfig.length > 0) return fromConfig;
    // Fallback: init from libraryArtists names
    const lib = (SPOTIFY_CONFIG as any).libraryArtists ?? [];
    return lib.map((a: any) => a.name).filter(Boolean);
  })(),
  customPlaylists: [],
  playHistory: [],
  settings: { ...SPOTIFY_CONFIG.settings },
  pendingPlaylistTrack: null,
  searchHistory: [],
  _temp: {
    queueToast: null,
    likedToast: null,
  },
};

// ── Store ──────────────────────────────────────────────────────────

export const useSpotifyStore = createAppStoreWithActions<SpotifyState, SpotifyActions>(
  'spotify',
  initialState,
  (set, get) => ({
    playTrack: (track, source) => {
      const s = get();
      const now = TimeService.now(), resolved = resolveSpotifyPlayback(s, now);
      const duration = parseSpotifyDurationMs(track.duration);
      const position = resolved.currentTrack?.id === track.id && (duration <= 0 || resolved.positionMs < duration) ? resolved.positionMs : 0;
      const inQueue = s.queue.find(t => t.id === track.id);
      const newQueue = inQueue ? s.queue : [track, ...s.queue];
      const newRecent = [track, ...s.recentPlays.filter(t => t.id !== track.id)].slice(0, 20);
      const entry: PlayHistoryEntry = {
        sourceType: source?.type ?? 'standalone',
        sourceId: source?.id ?? 'standalone',
        sourceTitle: source?.title ?? '',
        sourceCover: source?.cover,
        track,
        timestamp: TimeService.now(),
      };
      const newHistory = [entry, ...s.playHistory].slice(0, 100);
      set({
        currentTrack: track,
        isPlaying: true,
        playback: playbackAnchor(track, position, now, true),
        queue: newQueue,
        recentPlays: newRecent,
        playHistory: newHistory,
      });
    },

    setQueueWithTracks: (tracks, startIndex = 0, source) => {
      const s = get();
      const safeIndex = Number.isFinite(startIndex) ? Math.min(Math.max(0, Math.trunc(startIndex)), Math.max(0, tracks.length - 1)) : 0;
      const playedTrack = tracks[safeIndex] ?? null;
      const historyEntries: PlayHistoryEntry[] = playedTrack && source ? [{
        sourceType: source.type,
        sourceId: source.id,
        sourceTitle: source.title,
        sourceCover: source.cover,
        track: playedTrack,
        timestamp: TimeService.now(),
      }] : [];
      const newRecent = playedTrack
        ? [playedTrack, ...s.recentPlays.filter(t => t.id !== playedTrack.id)].slice(0, 20)
        : s.recentPlays;
      set({
        queue: tracks.slice(),
        currentTrack: playedTrack,
        isPlaying: playedTrack !== null,
        playback: playbackAnchor(playedTrack, 0, TimeService.now(), playedTrack !== null),
        recentPlays: newRecent,
        playHistory: [...historyEntries, ...s.playHistory].slice(0, 100),
      });
    },

    togglePlay: trackId => {
      const now = TimeService.now(), resolved = resolveSpotifyPlayback(get(), now);
      if (!resolved.currentTrack || (trackId !== undefined && resolved.currentTrack.id !== trackId)) return;
      const playing = !resolved.isPlaying, duration = parseSpotifyDurationMs(resolved.currentTrack.duration);
      const position = playing && duration > 0 && resolved.positionMs >= duration ? 0 : resolved.positionMs;
      set({ currentTrack: resolved.currentTrack, isPlaying: playing, playback: playbackAnchor(resolved.currentTrack, position, now, playing) });
    },

    seekPlayback: (value, trackId) => {
      if (!Number.isFinite(value)) return;
      const now = TimeService.now(), resolved = resolveSpotifyPlayback(get(), now), track = resolved.currentTrack;
      if (!track || (trackId !== undefined && track.id !== trackId)) return;
      const duration = parseSpotifyDurationMs(track.duration);
      if (duration <= 0) return;
      const position = Math.max(0, Math.min(duration, value)), playing = resolved.isPlaying && position < duration;
      set({ currentTrack: track, isPlaying: playing, playback: playbackAnchor(track, position, now, playing) });
    },

    syncPlayback: (now, previousNow) => {
      if (!Number.isFinite(now)) return;
      const s = get();
      const deadline = s.settings.playback.sleepTimerDeadlineMs ?? 0;
      if (deadline > 0 && now >= deadline) {
        const resolved = resolveSpotifyPlayback(s, deadline);
        set({
          currentTrack: resolved.currentTrack,
          isPlaying: false,
          playback: playbackAnchor(resolved.currentTrack, resolved.positionMs, deadline, false),
          settings: {
            ...s.settings,
            playback: { ...s.settings.playback, sleepTimer: 0, sleepTimerDeadlineMs: 0 },
          },
        });
        return;
      }
      const resolved = synchronizeSpotifyPlayback(s, now, previousNow);
      if (s.currentTrack !== resolved.currentTrack || s.isPlaying !== resolved.isPlaying || !samePlaybackAnchor(s.playback, resolved.playback)) {
        set({ currentTrack: resolved.currentTrack, isPlaying: resolved.isPlaying, playback: resolved.playback });
      }
    },

    checkpointPlayback: () => {
      const s = get(), now = TimeService.now(), resolved = resolveSpotifyPlayback(s, now);
      const anchor = playbackAnchor(resolved.currentTrack, resolved.positionMs, now, resolved.isPlaying);
      if (!s.isPlaying || (s.currentTrack === resolved.currentTrack && samePlaybackAnchor(s.playback, anchor))) return;
      set({ currentTrack: resolved.currentTrack, isPlaying: resolved.isPlaying, playback: anchor });
      // The OS's earlier pagehide flush may already have run; publish this late
      // checkpoint through its official immediate, function-stripping writer.
      const { _temp: omitted, ...persisted } = get();
      void omitted;
      writePersistedAppState('spotify', persisted);
    },

    toggleShuffle: () => {
      const nextShuffle = !get().shuffle;
      // 互斥：开启随机播放则关闭循环模式
      set({ shuffle: nextShuffle, repeat: nextShuffle ? 'off' : get().repeat });
    },

    toggleRepeat: () => {
      const s = get();
      const next = s.repeat === 'off' ? 'context' : s.repeat === 'context' ? 'track' : 'off';
      set({ repeat: next, shuffle: next !== 'off' ? false : s.shuffle });
    },

    toggleLike: (track) => {
      const s = get();
      const titleNorm = track.title.trim().toLowerCase();
      const artistNorm = track.artist.trim().toLowerCase();
      const exists = s.likedSongs.some(t =>
        t.id === track.id || (t.title.trim().toLowerCase() === titleNorm && t.artist.trim().toLowerCase() === artistNorm)
      );
      const patch: Partial<SpotifyState> = {
        likedSongs: exists
          ? s.likedSongs.filter(t =>
              t.id !== track.id && !(t.title.trim().toLowerCase() === titleNorm && t.artist.trim().toLowerCase() === artistNorm)
            )
          : [track, ...s.likedSongs],
      };
      if (!exists) set({ _temp: { ...get()._temp, likedToast: track } });
      set(patch);
    },

    toggleFollowArtist: (artistName) => {
      const s = get();
      const artistNorm = artistName.trim().toLowerCase();
      const exists = s.followedArtists.some(name => name.trim().toLowerCase() === artistNorm);
      set({
        followedArtists: exists
          ? s.followedArtists.filter(name => name.trim().toLowerCase() !== artistNorm)
          : [artistName, ...s.followedArtists],
      });
    },

    addToQueue: (track) => {
      const s = get();
      if (s.queue.some(t => t.id === track.id)) return;
      set({ queue: [...s.queue, track] });
    },

    showQueueToast: (track) => {
      set({ _temp: { ...get()._temp, queueToast: track } });
    },
    clearQueueToast: () => {
      set({ _temp: { ...get()._temp, queueToast: null } });
    },
    clearLikedToast: () => {
      set({ _temp: { ...get()._temp, likedToast: null } });
    },

    skipToNext: () => {
      const s = get();
      if (!s.currentTrack || s.queue.length === 0) return;
      const now = TimeService.now(), current = resolveSpotifyPlayback(s, now).currentTrack;
      const index = s.queue.findIndex(track => track.id === current?.id);
      const track = s.queue[(index + 1) % s.queue.length];
      set({ currentTrack: track, isPlaying: true, playback: playbackAnchor(track, 0, now, true) });
    },

    skipToPrevious: () => {
      const s = get();
      if (!s.currentTrack || s.queue.length === 0) return;
      const now = TimeService.now(), current = resolveSpotifyPlayback(s, now).currentTrack;
      const index = s.queue.findIndex(track => track.id === current?.id);
      const track = s.queue[index < 0 ? s.queue.length - 1 : (index - 1 + s.queue.length) % s.queue.length];
      set({ currentTrack: track, isPlaying: true, playback: playbackAnchor(track, 0, now, true) });
    },

    createPlaylist: (name, initialTrack = null) => {
      const s = get();
      const trackIds = initialTrack ? [initialTrack.id] : [];
      const storedTracks = initialTrack ? [initialTrack] : [];
      const newPlaylist = {
        id: nextId('cp'),
        title: name,
        subtitle: `歌单 • ${trackIds.length} 首歌曲|en:Playlist • ${trackIds.length} songs`,
        cover: initialTrack?.cover || '',
        type: 'playlist' as const,
        trackIds,
        storedTracks,
      } as SpotifyPlaylist & { trackIds: string[]; storedTracks: SpotifyTrack[] };
      set({ customPlaylists: [newPlaylist, ...(s.customPlaylists || [])] });
      return newPlaylist;
    },

    addTrackToPlaylist: (name, track) => {
      const s = get();
      const playlists = [...(s.customPlaylists || [])];
      let pl = playlists.find(p => (p as any).title === name);
      if (!pl) {
        pl = {
          id: nextId('cp'),
          title: name,
          subtitle: '歌单 • 0 首歌曲|en:Playlist • 0 songs',
          cover: '',
          type: 'playlist' as const,
        } as any;
        playlists.unshift(pl!);
      }
      const trackIds: string[] = Array.isArray((pl as any).trackIds) ? [...(pl as any).trackIds] : [];
      const storedTracks: SpotifyTrack[] = Array.isArray((pl as any).storedTracks) ? [...(pl as any).storedTracks] : [];
      const tNorm = track.title.trim().toLowerCase();
      const aNorm = track.artist.trim().toLowerCase();
      const dupById = trackIds.includes(track.id);
      const dupByName = storedTracks.some(t => t.title.trim().toLowerCase() === tNorm && t.artist.trim().toLowerCase() === aNorm);
      if (!dupById && !dupByName) {
        trackIds.push(track.id);
        storedTracks.push(track);
      }
      (pl as any).trackIds = trackIds;
      (pl as any).storedTracks = storedTracks;
      if (!((pl as any).cover) && track.cover) {
        (pl as any).cover = track.cover;
      }
      const count = trackIds.length;
      (pl as any).subtitle = `歌单 • ${count} 首歌曲|en:Playlist • ${count} songs`;
      set({ customPlaylists: playlists });
    },

    removeTrackFromPlaylist: (name, trackId) => {
      const s = get();
      const playlists = [...(s.customPlaylists || [])];
      const pl = playlists.find(p => (p as any).title === name);
      if (!pl) return;
      const trackIds: string[] = Array.isArray((pl as any).trackIds) ? [...(pl as any).trackIds] : [];
      const storedTracks: SpotifyTrack[] = Array.isArray((pl as any).storedTracks) ? [...(pl as any).storedTracks] : [];
      const nextIds = trackIds.filter(id => id !== trackId);
      const nextStored = storedTracks.filter(t => t.id !== trackId);
      (pl as any).trackIds = nextIds;
      (pl as any).storedTracks = nextStored;
      const count = nextIds.length;
      (pl as any).subtitle = `歌单 • ${count} 首歌曲|en:Playlist • ${count} songs`;
      // Update cover: use first remaining track's cover, or clear
      (pl as any).cover = nextStored.length > 0 ? (nextStored[0].cover || '') : '';
      set({ customPlaylists: playlists });
    },

    updateTrackCover: (trackId, newCover) => {
      const s = get();
      set({
        currentTrack: s.currentTrack?.id === trackId ? { ...s.currentTrack, cover: newCover } : s.currentTrack,
      });
    },

    // ── Settings ──────────────────────────────────────────────

    updateSettings: (category, patch) => {
      set(state => ({
        settings: {
          ...state.settings,
          [category]: { ...(state.settings[category] as any), ...patch },
        },
      }));
    },

    setSleepTimer: minutes => {
      if (![0, 5, 10, 15, 30, 45, 60].includes(minutes)) return;
      const now = TimeService.now();
      get().updateSettings('playback', {
        sleepTimer: minutes,
        sleepTimerDeadlineMs: minutes ? now + minutes * 60_000 : 0,
      });
    },

    // ── Accounts ──────────────────────────────────────────────

    addAccount: (name) => {
      const s = get();
      const colors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500'];
      const newColor = colors[s.accounts.length % colors.length];
      const newUser = {
        id: nextId('u'),
        name,
        initial: name.charAt(0).toUpperCase(),
        color: newColor,
      };
      set({ accounts: [...s.accounts, newUser], currentUser: newUser });
    },

    switchAccount: (userId) => {
      const s = get();
      const user = s.accounts.find(u => u.id === userId);
      if (!user) return;
      set({ currentUser: user });
    },

    setSearchResults: (query, tracks) => {
      const s = get();
      // 追加新搜索记录（同 query 则覆盖最后一条）
      const history = [...s.searchHistory];
      if (history.length > 0 && history[history.length - 1].query === query) {
        history[history.length - 1] = { query, tracks };
      } else {
        history.push({ query, tracks });
      }
      set({ searchHistory: history });
    },

  }),
);


// ── Memoized selectors (for derived arrays/objects) ───────────────

export const selectLikedSongs = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.likedSongs,
  (likedSongs) => likedSongs,
);

export const selectLikedSongIds = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.likedSongs,
  (likedSongs) => {
    const ids = new Set(likedSongs.map(t => t.id));
    const keys = new Set(likedSongs.map(t => `${t.title.trim().toLowerCase()}||${t.artist.trim().toLowerCase()}`));
    return {
      has(trackId: string, track?: { title: string; artist: string }) {
        if (ids.has(trackId)) return true;
        if (track) return keys.has(`${track.title.trim().toLowerCase()}||${track.artist.trim().toLowerCase()}`);
        return false;
      },
    };
  },
);

export const selectCustomPlaylists = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.customPlaylists,
  (customPlaylists) => customPlaylists,
);

export const selectQueue = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.queue,
  (queue) => queue,
);

export const selectRecentPlays = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.recentPlays,
  (recentPlays) => recentPlays,
);

// ── Shared simulator timeline and OS MediaSession publisher ───────────────
function restorePlaybackCheckpoint() {
  const state = useSpotifyStore.getState(), restored = restoreSpotifyPlayback(state, TimeService.now());
  const legacyTimer = state.settings.playback.sleepTimer > 0 && !state.settings.playback.sleepTimerDeadlineMs;
  if (state.isPlaying !== restored.isPlaying || !samePlaybackAnchor(state.playback, restored.playback) || legacyTimer) {
    useSpotifyStore.setState({
      isPlaying: restored.isPlaying,
      playback: restored.playback,
      ...(legacyTimer ? { settings: { ...state.settings, playback: { ...state.settings.playback, sleepTimer: 0 } } } : {}),
    });
  }
}
if (useSpotifyStore.persist.hasHydrated()) restorePlaybackCheckpoint();
const offHydration = useSpotifyStore.persist.onFinishHydration(restorePlaybackCheckpoint);

export const spotifyPlaybackRuntime = createSpotifyPlaybackRuntime({
  getState: useSpotifyStore.getState,
  subscribe: listener => useSpotifyStore.subscribe(listener),
  synchronize: (now, previousNow) => useSpotifyStore.getState().syncPlayback(now, previousNow),
  publish: (snapshot, state) => {
    const track = state.currentTrack;
    if (!track) {
      if (MediaSessionService.getActiveSession()?.packageName === 'com.spotify.music') MediaSessionService.clearActiveSession();
      return;
    }
    const session: ActiveMediaSession = {
      title: track.title ?? '', artist: track.artist ?? '', durationMs: snapshot.durationMs,
      positionMs: snapshot.positionMs, isPlaying: snapshot.isPlaying,
      packageName: 'com.spotify.music', activityClass: 'com.spotify.music.MainActivity',
    };
    MediaSessionService.setActiveSession(session);
  },
}, {
  now: TimeService.now,
  observe: listener => {
    const offSet = BroadcastBus.registerReceiver(ACTION_TIME_SET, listener);
    const offTick = BroadcastBus.registerReceiver(ACTION_TIME_TICK, listener);
    return () => { offSet(); offTick(); };
  },
  // Reset clears volatile OS services after the App stores; restore the session.
  observeBoot: listener => BroadcastBus.registerReceiver(ACTION_BOOT_COMPLETED, listener),
  schedule: listener => {
    if (typeof window === 'undefined') return () => {};
    const timer = window.setInterval(listener, 250);
    return () => window.clearInterval(timer);
  },
});
let playbackActive = true;
const checkpoint = () => { if (playbackActive) useSpotifyStore.getState().checkpointPlayback(); };
const checkpointHidden = () => { if (document.visibilityState === 'hidden') checkpoint(); };
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', checkpoint);
  document.addEventListener('visibilitychange', checkpointHidden);
}
if (import.meta.hot) import.meta.hot.dispose(() => {
  playbackActive = false;
  spotifyPlaybackRuntime.dispose();
  offHydration();
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', checkpoint);
    document.removeEventListener('visibilitychange', checkpointHidden);
  }
});
