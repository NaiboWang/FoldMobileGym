import React, { useState, useEffect } from 'react';
import '../player-reference.css';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { IcExpand, IcMoreVertical, IcMore, IcPlay, IcPause, IcSkipPrev, IcSkipNext, IcShuffle, IcRepeat, IcMic, IcShare, IcQueue, IcAddCircle, IcLikedIndicator, IcPlayerParallel, IcPlayerFull } from '../res/icons';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { PlayingIndicator } from '../components/PlayingIndicator';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import { QueueSheetPanel } from '../components/QueueSheetPanel';
import { SleepTimerSheet } from '../components/SleepTimerSheet';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { openSaveLocation } from '../components/LikedToast';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { PlaybackSeekBar } from '../components/PlaybackSeekBar';
import { getTrackCover, getTrackCoverLarge } from '../utils/artwork';
export const PlayerPage: React.FC = () => {
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [searchParams, setSearchParams] = useSearchParams();
    const { bindTap, bindBack, back } = useSpotifyGestures();
    const s = useSpotifyStrings();
    const { currentTrack, isPlaying, shuffle, repeat, queue, customPlaylists } = useSpotifyStore(useShallow(s => ({
        currentTrack: s.currentTrack, isPlaying: s.isPlaying, shuffle: s.shuffle, repeat: s.repeat, queue: s.queue, customPlaylists: s.customPlaylists,
    })));
    const togglePlay = useSpotifyStore(s => s.togglePlay);
    const playTrack = useSpotifyStore(s => s.playTrack);
    const toggleShuffle = useSpotifyStore(s => s.toggleShuffle);
    const toggleRepeat = useSpotifyStore(s => s.toggleRepeat);
    const skipToNext = useSpotifyStore(s => s.skipToNext);
    const skipToPrevious = useSpotifyStore(s => s.skipToPrevious);
    const toggleLike = useSpotifyStore(s => s.toggleLike);
    const likedSongIds = useSpotifyStore(selectLikedSongIds);
    const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
    const addTrackToPlaylist = useSpotifyStore(s => s.addTrackToPlaylist);
    const removeTrackFromPlaylist = useSpotifyStore(s => s.removeTrackFromPlaylist);
    const showQueue = searchParams.get('sheet') === 'queue';
    const showMenu = searchParams.get('sheet') === 'track_menu';
    const showAddPlaylist = searchParams.get('sheet') === 'add_playlist';
    const showSleepTimer = searchParams.get('sheet') === 'timer';
    const menuTrackId = searchParams.get('trackId');
    const menuTrack = useSpotifyStore(state => !menuTrackId ? null : state.currentTrack?.id === menuTrackId ? state.currentTrack
        : state.queue.find(track => track.id === menuTrackId) ?? state.recentPlays.find(track => track.id === menuTrackId)
        ?? state.likedSongs.find(track => track.id === menuTrackId) ?? null);
    const updateSettings = useSpotifyStore(st => st.updateSettings);
    const playback = useSpotifyPlayback();
    
    // Progressive Image Loading State
    const [highResCover, setHighResCover] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Effect: use cached high-res artwork when the track data provides it.
    const cover = currentTrack?.cover;
    const coverLarge = currentTrack?.coverLarge;
    useEffect(() => {
        const cachedLargeCover = coverLarge && coverLarge !== cover ? coverLarge : null;
        setHighResCover(cachedLargeCover);
        setImageLoaded(!cachedLargeCover);
    }, [cover, coverLarge]);

    // Effect: Redirect if no track
    useEffect(() => {
        if (!currentTrack) {
            // 尽力回退到来源页；若无来源，保持空渲染即可
            back();
        }
    }, [currentTrack, back]);

    if (!currentTrack) return null;

    const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);

    const isLikedTrack = isLiked(currentTrack.id, currentTrack);
    const showBaseCover = !highResCover || !imageLoaded;

    return (
        <div className="spotify-player-reference flex flex-col h-full bg-gradient-to-b from-[#775544] to-app-surface relative overflow-hidden text-white font-sans" data-status-bar-foreground="light" data-navigation-bar-foreground="light">
            {/* Main Player Content */}
            <div className={`spotify-player-content flex flex-col p-6 ${showQueue ? 'scale-95 opacity-50' : ''}`} style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} data-scroll-container="player" data-scroll-direction="vertical">
                {/* Header */}
                <div className="spotify-player-header flex justify-between items-center mb-6 pt-4">
                    <div className="spotify-player-header-start">
                        {searchParams.get('layout') === 'parallel' ? (
                            <button className="spotify-player-layout-toggle" aria-label={s.player_layout_full} {...bindTap('player.layout.full')}><IcPlayerFull size={23} /></button>
                        ) : (
                            <button className="spotify-player-layout-toggle" aria-label={s.player_layout_parallel} {...bindTap('player.layout.parallel')}><IcPlayerParallel size={23} /></button>
                        )}
                    <button {...bindBack()} aria-label={s.player_close} className="cursor-pointer">
                        <IcExpand size={28} />
                    </button>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-base tracking-widest text-white/70 uppercase">{s.player_playing_from}</span>
                        <span className="font-bold text-base">{displayText(currentTrack.artist)} {s.player_radio_suffix}</span>
                    </div>
                    <button
                        {...bindTap('player.trackMenu.open', {
                            params: { trackId: currentTrack.id },
                        })}
                        className="cursor-pointer"
                    >
                        <IcMoreVertical size={28} />
                    </button>
                </div>

                {/* Art - Moved down significantly & Progressive Loading */}
                <div className="spotify-player-art flex-1 flex items-center justify-center mt-4 mb-2 w-full max-h-(--app-player-album-art-max-height) self-center relative">
                    <div className="w-full aspect-square shadow-2xl rounded-md overflow-hidden bg-gray-800 relative">
                        {/* 1. Low Res Base Layer (Visible until High Res loads) */}
                        <img
                            src={getTrackCover(currentTrack)}
                            alt={displayText(currentTrack.title)}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${showBaseCover ? 'opacity-100' : 'opacity-0'}`}
                        />

                        {/* 2. High Res Layer (Fade In) */}
                        {highResCover && (
                            <img
                                src={highResCover}
                                alt=""
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                                onLoad={() => setImageLoaded(true)}
                            />
                        )}
                        {!getTrackCover(currentTrack) && !highResCover && (
                            <div className="w-full h-full flex items-center justify-center bg-gray-700"><IcMic size={48} className="text-gray-500" /></div>
                        )}
                    </div>
                </div>

                {/* Lyrics snippet - centered between album art and track info */}
                <div className="spotify-player-lyrics flex-1 flex items-center pt-6">
                    <div className="text-white text-lg font-bold text-left">
                        {s.player_lyrics_unavailable}
                    </div>
                </div>

                {/* Track and controls remain in this single scrollable player. */}
                <div className="spotify-player-controls">
                    {/* Info */}
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex-1 min-w-0 pr-4">
                            <h1 data-testid="spotify-player-track-title" className="text-2xl font-bold mb-1 truncate">{displayText(currentTrack.title)}</h1>
                            <p className="text-gray-300 text-lg truncate">{displayText(currentTrack.artist)}</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <button
                                {...bindTap(
                                    { kind: 'action', id: 'track.like.toggle' },
                                    {
                                        params: { trackId: currentTrack.id, to: !isLikedTrack },
                                        onTrigger: () => {
                                            if (isLikedTrack) {
                                                openSaveLocation(currentTrack, setSearchParams);
                                            } else {
                                                toggleLike(currentTrack);
                                            }
                                        },
                                    },
                                )}
                            >
                                {isLikedTrack ? <IcLikedIndicator size={40} /> : <IcAddCircle size={40} />}
                            </button>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mb-6">
                        <PlaybackSeekBar trackId={currentTrack.id} positionMs={playback.trackId === currentTrack.id ? playback.positionMs : 0}
                            durationMs={playback.durationMs} durationText={currentTrack.duration} />
                    </div>

                    <p className="spotify-player-simulation">{s.player_simulated}</p>

                    {/* Controls */}
                    <div className="flex justify-between items-center mb-8 px-2">
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.shuffle.toggle' },
                                { params: { to: !shuffle }, onTrigger: toggleShuffle },
                            )}
                            className="cursor-pointer"
                        >
                            <IcShuffle size={28} className={shuffle ? 'text-app-primary' : 'text-white/70 hover:text-white'} />
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.control.skipPrevious' },
                                { onTrigger: skipToPrevious },
                            )}
                            className="active:scale-90 transition-transform cursor-pointer"
                        >
                            <IcSkipPrev size={40} fill="white" />
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'track.play.toggle' },
                                {
                                    params: { trackId: currentTrack.id, to: !isPlaying },
                                    onTrigger: () => togglePlay(currentTrack.id),
                                },
                            )}
                            aria-label={isPlaying ? s.player_pause : s.player_play}
                            className="w-18 h-18 bg-white rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer shadow-lg"
                        >
                            {isPlaying ? <IcPause size={36} fill="black" /> : <IcPlay size={36} fill="black" className="translate-x-0.5" />}
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.control.skipNext' },
                                { onTrigger: skipToNext },
                            )}
                            className="active:scale-90 transition-transform cursor-pointer"
                        >
                            <IcSkipNext size={40} fill="white" />
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.repeat.toggle' },
                                { params: { to: repeat !== 'track' }, onTrigger: toggleRepeat },
                            )}
                            className="cursor-pointer relative"
                        >
                            <IcRepeat size={28} className={repeat !== 'off' ? 'text-app-primary' : 'text-white/70 hover:text-white'} />
                            {repeat === 'track' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-app-primary pt-0.5">1</div>}
                        </button>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex justify-between items-center px-2">
                        <IcMic size={24} className="text-white/70 cursor-pointer" />
                        <div className="flex gap-6">
                            <IcShare size={24} className="text-white/70 cursor-pointer" />
                            <button
                                {...bindTap('player.queue.open')}
                                className="text-white/70 cursor-pointer"
                            >
                                <IcQueue size={24} />
                            </button>
                        </div>
                    </div>
                </div>
                <section className="spotify-player-preview">
                    <h2>{s.player_lyrics_preview}</h2>
                    <p>{s.player_lyrics_unavailable}</p>
                </section>
            </div>

            {/* Queue Sheet Overlay */}
            {showQueue && (
                <QueueSheetPanel
                    backdropProps={bindBack({ stopPropagation: true })}
                    onClose={() => back()}
                    coverOverride={highResCover || getTrackCoverLarge(currentTrack) || undefined}
                />
            )}
            
            {/* Track Menu Overlay */}
            {menuTrack && (
                <PlayerPageMenuOverlay
                    currentTrack={menuTrack}
                    isOpen={showMenu && !!menuTrackId}
                    liked={isLiked(menuTrack.id, menuTrack)}
                    bindBack={bindBack}
                    bindTap={bindTap}
                    toggleLike={toggleLike}
                    back={back}
                />
            )}
            
            {menuTrack && (
                <AddToPlaylistSheet
                    isOpen={showAddPlaylist && !!menuTrackId}
                    track={menuTrack}
                    backdropProps={bindBack({ stopPropagation: true })}
                    onSelect={() => {}}
                    onRemoveFromPlaylist={() => {}}
                    onLike={() => {}}
                    onClose={() => back()}
                />
            )}

            {showSleepTimer && (
                <SleepTimerSheet backdropProps={bindBack({ stopPropagation: true })} onClose={() => back()} />
            )}
        </div>
    );
};

// Bottom sheet menu for current track
export const PlayerPageMenuOverlay: React.FC<{ currentTrack: any; isOpen: boolean; liked: boolean; bindBack: any; bindTap: any; toggleLike: any; back?: () => void }> = ({ currentTrack, isOpen, liked, bindBack, bindTap, toggleLike, back }) => {
    const lyricsEnabled = useSpotifyStore(st => st.settings.playback.lyricsEnabled);
    const updateSettings = useSpotifyStore(st => st.updateSettings);

    if (!currentTrack) return null;
    return (
        <TrackMenuSheet
            track={currentTrack}
            isOpen={isOpen}
            liked={liked}
            likedTrackMenuVariant="otherPlaylistsOnly"
            onClose={() => back?.()}
            backdropProps={bindBack({ stopPropagation: true })}
            shareProps={bindTap(
                { kind: 'action', id: 'track.share.invoke' },
                { params: { trackId: currentTrack.id }, onTrigger: () => back?.(), stopPropagation: true },
            )}
            lyricsOn={lyricsEnabled}
            lyricsProps={{
                onClick: () => {
                    updateSettings('playback', { lyricsEnabled: !lyricsEnabled });
                },
            }}
            sleepTimerProps={bindTap('player.timer.openFromMenu')}
            likeProps={bindTap(
                { kind: 'action', id: 'track.like.toggle' },
                { params: { trackId: currentTrack.id, to: !liked }, onTrigger: () => toggleLike(currentTrack), stopPropagation: true }
            )}
            addToPlaylistProps={bindTap('player.addPlaylist.open', { params: { trackId: currentTrack.id }, stopPropagation: true })}
            addToQueueProps={bindTap(
                { kind: 'action', id: 'track.queue.add' },
                {
                    params: { trackId: currentTrack.id },
                    stopPropagation: true,
                    onTrigger: () => {
                        useSpotifyStore.getState().addToQueue(currentTrack);
                        useSpotifyStore.getState().showQueueToast(currentTrack);
                        back?.();
                    },
                }
            )}
            goToAlbumProps={bindTap('playlist.open', { params: { id: currentTrack.id } })}
            goToArtistProps={bindTap('artist.open', { params: { name: String(currentTrack.artist) } })}
            createJamProps={bindTap('tab.premium')}
        />
    );
}
