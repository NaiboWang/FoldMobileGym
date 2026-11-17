import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { UNSAFE_NavigationContext, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useActivityContext } from '../../../os/ActivityContext';
import { canAdvanceVisiblePreview } from '../utils/previewVisibility';
import TaskManager from '../../../os/TaskManager';
import { nextFavoritePreview } from '../utils/favoritePreviewQueue';
import { IcNavBack, IcNavForward, IcExpand, IcMore, IcLike, IcDislike, IcCoins, IcStar, IcShare, IcAdd, IcMonitorPlay, IcPlay, IcPause, IcPlayCircle, IcPauseCircle, IcMessage, IcAlignLeft, IcSend, IcBan, IcMenu, IcLightning, IcClose, IcCheck, IcCircleDollarSign } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward, ChevronDown = IcExpand, MoreHorizontal = IcMore, ThumbsUp = IcLike, ThumbsDown = IcDislike, Coins = IcCoins, Star = IcStar, Share2 = IcShare, Plus = IcAdd, MonitorPlay = IcMonitorPlay, Play = IcPlay, Pause = IcPause, PlayCircle = IcPlayCircle, PauseCircle = IcPauseCircle, MessageSquare = IcMessage, AlignLeft = IcAlignLeft, Send = IcSend, Ban = IcBan, Menu = IcMenu, Zap = IcLightning, X = IcClose, Check = IcCheck, CircleDollarSign = IcCircleDollarSign;
import { FavToast, FavSheet } from './FavSheet';
import { BILIBILI_CONFIG } from '../data';
import { RECOMMEND_DATA } from '../data/recommendData';
import { BilibiliVideo } from '../types';
import { useVideos, useVideoTags, useVideoOnline, useAuthors } from '../hooks/useData';
import { useSystemTime } from '../../../os/useSystemTime';
import { realNow } from '../../../os/TimeService';
import * as TimeService from '../../../os/TimeService';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliEntryOwner } from '../hooks/useBilibiliEntryOwner';
import { BilibiliDanmakuIcon } from '../res/icons';
import { VideoDetailScroll } from '../context/VideoPlaybackContext';
import { COMPACT_VIDEO_HEIGHT, videoHeaderLayout } from '../utils/detailHeader';
import { VideoPlayer } from '../components/VideoPlayer';
import { BilibiliCommentEntry, BilibiliCommentList, BilibiliCommentOverlay } from '../components/CommentsPanel';
import { useCommentSource } from '../hooks/useCommentSource';
import { parseVideoDuration } from '../utils/videoPlayback';
import { getPlaybackEntryKey, isVideoFullscreen, isVideoCommentPanel } from '../utils/playerNavigation';
import { useAppStrings } from '../../../os/useAppStrings';
import { useLocale } from '../locale';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import coinMascotImg from '../assets/22-coin.png';
// “你可能感兴趣”面板是本地子状态：绑定到同一个 history entry（idx），push/back 仍保留；entry 被 pop 后消失
const videoIntroLocalStateByEntryId = new Map<string, { suggestionsOpen: boolean }>();

let pendingNewFavFolderId: string | null = null;
export function setPendingNewFavFolder(id: string) {
    pendingNewFavFolderId = id;
}

const formatStat = (num: number | string | undefined) => {
    if (num === undefined || num === null) return '0';
    // If it's already formatted (contains non-numeric characters like Wan/Yi), return as is
    if (typeof num === 'string' && (num.includes('万') || num.includes('亿'))) {
        return num;
    }
    const val = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(val)) return '0';

    if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
    return val.toString();
};

const formatDate = (ts: number | undefined) => {
    if (!ts) {
        // Fallback to a default time if timestamp is missing
        return '2026年1月1日 18:30';
    }
    const date = TimeService.fromTimestamp(ts * 1000);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export const VideoDetailPage: React.FC = () => {
    const { bvid } = useParams<{ bvid: string }>();
    const videos = useVideos();
    const { bindBack } = useBilibiliGestures();
    const s = useAppStrings(strings, stringsEn, useLocale());
    const video = videos.find(value => value.id === bvid);
    if (!video) return (
        <div className="h-full w-full pt-10 flex flex-col items-center justify-center gap-4 bg-app-surface" data-status-bar-foreground="dark">
            <div role="alert">{s.video_unavailable}</div>
            <button {...bindBack()} className="text-app-primary px-4 py-2">{s.player_back}</button>
        </div>
    );
    return <VideoDetailContent key={video.id} video={video} videos={videos} />;
};

const VideoDetailContent: React.FC<{ video: BilibiliVideo; videos: BilibiliVideo[] }> = ({ video, videos: VIDEO_DATA }) => {
    const { bvid } = useParams<{ bvid: string }>();
    const { bindTap, bindLongPress, bindBack, go, back } = useBilibiliGestures();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const ownsFavoriteEntry = useBilibiliEntryOwner();

    const { now } = useSystemTime();

    const VIDEO_TAGS = useVideoTags();
    const VIDEO_ONLINE = useVideoOnline();
    const commentSource = useCommentSource();
    const localComments = useBilibiliStore(state => state.localComments?.[video.id]);
    const [commentRevealId, setCommentRevealId] = useState<string | null>(null);
    const commentCount = commentSource.ready && !commentSource.error && !commentSource.data?.[video.id]?.error ? (commentSource.data?.[video.id]?.count ?? 0) + (localComments?.length ?? 0) : '…';
    const AUTHOR_DATA = useAuthors();

    const toggleFollow = useBilibiliStore(s => s.toggleFollow);
    const biliUser = useBilibiliStore(s => s.user);
    const toggleLike = useBilibiliStore(s => s.toggleLike);
    const toggleDislike = useBilibiliStore(s => s.toggleDislike);
    const addCoin = useBilibiliStore(s => s.addCoin);
    const toggleFav = useBilibiliStore(s => s.toggleFav);
    const tripleAction = useBilibiliStore(s => s.tripleAction);
    const isFollowing = (id: string | number) => {
        const mid = String(id);
        return (biliUser.followingList || []).some(u => String(u.mid) === mid);
    };
    const checkInteractions = (vid: string) => ({
        liked: (biliUser.likedVideoIds || []).includes(vid),
        disliked: (biliUser.dislikedVideoIds || []).includes(vid),
        coined: ((biliUser.coinedVideoCoins || {})[vid] || 0) > 0,
        coinCount: (biliUser.coinedVideoCoins || {})[vid] || 0,
        favored: (biliUser.favoritesFolders || []).some(f => (f.videoIds || []).includes(vid)),
    });
    const setActiveVideoId = useBilibiliStore(s => s.setActiveVideoId);
    const recordVideoVisit = useBilibiliStore(s => s.recordVideoVisit);

    // Track active video
    useEffect(() => {
        setActiveVideoId(bvid || null);
        if (bvid) recordVideoVisit(bvid);
        return () => setActiveVideoId(null);
    }, [bvid, setActiveVideoId, recordVideoVisit]);

    // Tab Logic (URL Param)
    const activeTab = (searchParams.get('tab') as 'intro' | 'comment') || 'intro';

    const [isExpanded, setIsExpanded] = useState(false);

    const [longPressProgress, setLongPressProgress] = useState(0);
    const animationFrameRef = useRef<any>(null);
    const isLongPressTriggeredRef = useRef(false);
    const isPressingRef = useRef(false);
    const [toast, setToast] = useState<{ show: boolean, msg: string }>({ show: false, msg: '' });

    const [showFavToast, setShowFavToast] = useState(false);
    const [showFavSheet, setShowFavSheet] = useState(false);
    const [pendingFolderId, setPendingFolderId] = useState<string | null>(null);
    const favToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // URL Params Logic
    const showMenu = searchParams.get('menu') === 'true';
    // 推荐面板：不进入 URL；绑定到同一个 history entry（优先 idx，其次 location.key）
    const entryId = React.useMemo(() => {
        const rawIdx = (window.history.state as any)?.idx;
        const idx =
            typeof rawIdx === 'number'
                ? rawIdx
                : typeof rawIdx === 'string' && rawIdx.trim() !== ''
                    ? Number(rawIdx)
                    : NaN;
        if (Number.isFinite(idx)) {
            return `bili:video:idx:${idx}`;
        }
        // 兜底：idx 不可用时使用 location.key；但 replace（切 tab）会生成新 key，
        // 因此下面会在同一 bvid 下把旧 key 的状态迁移到新 key，避免丢失。
        return `bili:video:key:${location.key}`;
    }, [location.key, location.pathname, location.search]);

    const lastEntryIdRef = useRef<string | null>(null);
    const lastBvidRef = useRef<string | undefined>(undefined);

    const [showSuggestionPanel, setShowSuggestionPanel] = useState(() => {
        return videoIntroLocalStateByEntryId.get(entryId)?.suggestionsOpen ?? false;
    });

    useEffect(() => {
        const existing = videoIntroLocalStateByEntryId.get(entryId);
        if (existing) {
            setShowSuggestionPanel(existing.suggestionsOpen);
        } else {
            // 当 entryId 变化但仍在同一个 bvid（典型：replace 切 tab 导致 key 变化）时，迁移上一 entry 的状态
            const prevEntryId = lastEntryIdRef.current;
            const prevBvid = lastBvidRef.current;
            if (prevEntryId && prevBvid === bvid) {
                const prev = videoIntroLocalStateByEntryId.get(prevEntryId);
                if (prev) {
                    videoIntroLocalStateByEntryId.set(entryId, { suggestionsOpen: prev.suggestionsOpen });
                    setShowSuggestionPanel(prev.suggestionsOpen);
                } else {
                    setShowSuggestionPanel(false);
                }
            } else {
                setShowSuggestionPanel(false);
            }
        }

        lastEntryIdRef.current = entryId;
        lastBvidRef.current = bvid;
    }, [entryId, bvid]);

    useEffect(() => {
        videoIntroLocalStateByEntryId.set(entryId, { suggestionsOpen: showSuggestionPanel });
    }, [entryId, showSuggestionPanel]);

    // 相关推荐：优先同分区视频，分区为空或不足时从 RECOMMEND_DATA 补足
    const relatedVideos = React.useMemo(() => {
        const exclude = new Set<string>([video.id]);
        const result: typeof VIDEO_DATA = [];
        const partition = video.partition;
        if (partition) {
            for (const v of VIDEO_DATA) {
                if (result.length >= 5) break;
                if (exclude.has(v.id) || v.partition !== partition) continue;
                result.push(v);
                exclude.add(v.id);
            }
        }
        if (result.length < 5) {
            const fullById = new Map(VIDEO_DATA.map(v => [v.id, v]));
            for (const r of RECOMMEND_DATA) {
                if (result.length >= 5) break;
                if (exclude.has(r.id)) continue;
                const full = fullById.get(r.id);
                if (full) {
                    result.push(full);
                    exclude.add(r.id);
                }
            }
        }
        return result;
    }, [video.id, video.partition, VIDEO_DATA]);

    // Get Author Data if available
    let mid = video.raw?.owner?.mid;

    // Fallback: search by author name if mid is missing
    if (!mid && video.author) {
        const foundAuthor = Object.values(AUTHOR_DATA).find(u => u.name === video.author);
        if (foundAuthor) {
            mid = foundAuthor.mid;
        }
    }

    const showToast = (msg: string) => {
        setToast({ show: true, msg });
        setTimeout(() => setToast({ show: false, msg: '' }), 2000);
    };


    // Ensure stats exist (Mock if missing)
    const stats = React.useMemo(() => {
        if (video?.stats) return video.stats;
        const plays = video?.plays || 10000;
        return {
            likes: Math.floor(plays * 0.08) || 123,
            coins: Math.floor(plays * 0.02) || 45,
            favorites: Math.floor(plays * 0.04) || 67,
            shares: Math.floor(plays * 0.01) || 12,
            favs: Math.floor(plays * 0.04) || 67
        };
    }, [video]);

    const { liked, disliked, coined, coinCount, favored } = checkInteractions(video!.id);
    const showCoinDialog = searchParams.get('coinDialog') === 'open';

    const handleLikeStart = (e: React.PointerEvent) => {
        // Prevent default browser actions if needed, but scrolling is important.
        // Usually Pointer Events are fine. 
        isLongPressTriggeredRef.current = false;
        isPressingRef.current = true;

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        const startTime = realNow();
        const duration = 800;

        const animate = () => {
            if (!isPressingRef.current) return;

            const elapsed = realNow() - startTime;
            const p = Math.min(100, (elapsed / duration) * 100);
            setLongPressProgress(p);

            if (p >= 100) {
                isLongPressTriggeredRef.current = true;
                isPressingRef.current = false; // Stop pressing
                const res = tripleAction(video!.id);
                showToast(res.msg);
                setLongPressProgress(0);
                return;
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleLikeEnd = (e: React.PointerEvent) => {
        isPressingRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setLongPressProgress(0);

        // Click Logic
        if (!isLongPressTriggeredRef.current) {
            toggleLike(video!.id);
        }
        isLongPressTriggeredRef.current = false;
    };

    const handleLikeCancel = (e: React.PointerEvent) => {
        isPressingRef.current = false;
        isLongPressTriggeredRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setLongPressProgress(0);
    };

    const handleCoinClick = () => {
        go('video.coinDialog.open', {});
    };

    const [coinDialogSelected, setCoinDialogSelected] = useState(1);
    const [coinDialogAlsoLike, setCoinDialogAlsoLike] = useState(true);
    const coinDialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showCoinDialog) return;
        const el = coinDialogRef.current;
        if (!el) return;
        const prevent = (e: TouchEvent) => e.preventDefault();
        el.addEventListener('touchmove', prevent, { passive: false });
        return () => el.removeEventListener('touchmove', prevent);
    }, [showCoinDialog]);

    const coinTouchRef = useRef<{ startX: number, startY: number } | null>(null);
    const mascotTouchRef = useRef<{ startY: number, triggered: boolean } | null>(null);

    useEffect(() => {
        if (showCoinDialog) {
            setCoinDialogSelected(1);
            setCoinDialogAlsoLike(true);
        }
    }, [showCoinDialog]);

    const handleCoinSubmit = () => {
        const res = addCoin(video!.id, coinDialogSelected, coinDialogAlsoLike);
        back();
        if (!res.success) {
            showToast(res.msg);
        } else {
            showToast('投币成功');
        }
    };


    const handleCoinPointerDown = (e: React.PointerEvent) => {
        coinTouchRef.current = { startX: e.clientX, startY: e.clientY };
    };

    const handleCoinPointerMove = (e: React.PointerEvent) => {
        if (!coinTouchRef.current) return;
        const dx = e.clientX - coinTouchRef.current.startX;
        if (Math.abs(dx) > 30) {
            setCoinDialogSelected(dx < 0 ? 2 : 1);
            coinTouchRef.current.startX = e.clientX;
        }
    };

    const handleCoinPointerUp = () => {
        coinTouchRef.current = null;
    };

    const handleMascotPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        mascotTouchRef.current = { startY: e.clientY, triggered: false };
        try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch (_) {}
    };

    const handleMascotPointerMove = (e: React.PointerEvent) => {
        if (!mascotTouchRef.current || mascotTouchRef.current.triggered) return;
        const dy = e.clientY - mascotTouchRef.current.startY;
        if (dy < -50) {
            mascotTouchRef.current.triggered = true;
            handleCoinSubmit();
        }
    };

    const handleMascotPointerUp = (e: React.PointerEvent) => {
        if (!mascotTouchRef.current) return;
        try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch (_) {}
        mascotTouchRef.current = null;
    };

    const handleFav = useCallback(() => {
        if (!ownsFavoriteEntry()) return;
        const vid = video!.id;
        const wasFavored = (biliUser.favoritesFolders || []).some(f => (f.videoIds || []).includes(vid));
        const live = useBilibiliStore.getState().user;
        if (live.uid !== biliUser.uid || (live.favoritesFolders || []).some(f => (f.videoIds || []).includes(vid)) !== wasFavored) return;
        toggleFav(vid);
        const added = (useBilibiliStore.getState().user.favoritesFolders || []).some(f => (f.videoIds || []).includes(vid));
        if (!wasFavored && added) {
            if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
            setShowFavToast(true);
            favToastTimerRef.current = setTimeout(() => setShowFavToast(false), 3000);
        } else {
            setShowFavToast(false);
            if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
            if (!wasFavored && !added) setShowFavSheet(true);
        }
    }, [video, biliUser.favoritesFolders, biliUser.uid, toggleFav, ownsFavoriteEntry]);



    const handleOpenFavSheet = useCallback(() => {
        if (!ownsFavoriteEntry() || useBilibiliStore.getState().user.uid !== biliUser.uid) return;
        setShowFavToast(false);
        if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
        setShowFavSheet(true);
    }, [ownsFavoriteEntry, biliUser.uid]);

    const handleCreateFolderFromSheet = useCallback(() => {
        if (!ownsFavoriteEntry() || useBilibiliStore.getState().user.uid !== biliUser.uid) return;
        setShowFavSheet(false);
        go('favCreate.open', {});
    }, [go, ownsFavoriteEntry, biliUser.uid]);

    useEffect(() => {
        if (pendingNewFavFolderId) {
            const id = pendingNewFavFolderId;
            pendingNewFavFolderId = null;
            setPendingFolderId(id);
            setShowFavSheet(true);
        }
    });

    useEffect(() => {
        return () => {
            if (favToastTimerRef.current) clearTimeout(favToastTimerRef.current);
        };
    }, []);


    const fullscreen = isVideoFullscreen(location.pathname, location.search);
    const commentPanelOpen = !fullscreen && isVideoCommentPanel(location.pathname, location.search);
    const { activityId, taskId } = useActivityContext();
    const [windowRevision, setWindowRevision] = useState(0);
    useEffect(() => {
        const onWindowChange = () => setWindowRevision(value => value + 1);
        window.addEventListener('foldagent:windowchange', onWindowChange);
        return () => window.removeEventListener('foldagent:windowchange', onWindowChange);
    }, []);
    const { navigator } = React.useContext(UNSAFE_NavigationContext);
    const osState = React.useSyncExternalStore(TaskManager.subscribe, TaskManager.getState, TaskManager.getState);
    const [queueEndPending, setQueueEndPending] = useState(false);
    const queueClaim = useRef<string | null>(null);
    useEffect(() => {
        if (!queueEndPending || fullscreen || commentPanelOpen || showMenu || showCoinDialog || showFavSheet) return;
        const os = TaskManager.getState();
        const live = (navigator as unknown as { location?: { key: string } }).location;
        const multi = window.__FOLDAGENT__?.getState().multi_window;
        if (!canAdvanceVisiblePreview(os, activityId, taskId, multi) || (live && live.key !== location.key)) return;
        const queue = (location.state as { bilibiliFavoritePreviewQueue?: unknown } | null)?.bilibiliFavoritePreviewQueue;
        const available = new Set(VIDEO_DATA.filter(item => parseVideoDuration(item.duration) > 0).map(item => item.id));
        const next = nextFavoritePreview(queue, video.id, available);
        setQueueEndPending(false);
        if (!next || queueClaim.current === location.key) return;
        queueClaim.current = location.key;
        go('video.previewQueue.next', { bvid: next.ids[next.index] }, { state: { bilibiliFavoritePreviewQueue: next } });
    }, [queueEndPending, fullscreen, commentPanelOpen, showMenu, showCoinDialog, showFavSheet, osState, windowRevision, location, activityId, taskId, navigator, VIDEO_DATA, video.id, go]);

    const openingFullscreen = useRef<string | null>(null);
    useEffect(() => { openingFullscreen.current = null; }, [location.key]);
    const fullscreenProps = bindTap('video.player.fullscreen.open', { onTrigger: () => {
        if (openingFullscreen.current === location.key) return;
        openingFullscreen.current = location.key;
        go('video.player.fullscreen.open');
    } });

    // Mock data for UI elements not in the main config
    const upInfo = {
        name: video.author || 'UP主',
        face: video.face || '',
    };

    const authorProfile = mid ? AUTHOR_DATA[mid] : null;
    const realFans = authorProfile ? formatStat(authorProfile.follower) : '0';
    const realVideoCount = authorProfile ? authorProfile.videos.length : 0;

    const isFollowed = isFollowing(mid || '');

    const headerRef = useRef<HTMLDivElement>(null);
    const [headerWidth, setHeaderWidth] = useState(0);
    const [detailScrollTop, setDetailScrollTop] = useState(0);
    useLayoutEffect(() => {
        const element = headerRef.current;
        if (!element) return;
        setHeaderWidth(element.clientWidth);
        const observer = new ResizeObserver(entries => {
            const width = entries[0]?.contentRect.width ?? 0;
            setHeaderWidth(Math.max(0, width));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const header = videoHeaderLayout(headerWidth, detailScrollTop);
    const detailHeaderHeight = `calc(2.5rem + max(${COMPACT_VIDEO_HEIGHT}px, calc(56.25cqw - ${header.collapse}px)))`;
    const headerExtentRef = useRef(0);
    headerExtentRef.current = header.maxCollapse;
    const reportDetailScroll = useCallback((top: number) => {
        // Once compact, body scrolling must not re-render the whole detail tree.
        setDetailScrollTop(Math.min(headerExtentRef.current, Math.max(0, top)));
    }, []);

    return (
        <div className="flex flex-col h-full min-h-0 bg-app-surface relative" style={{ containerType: 'inline-size' }} data-status-bar-foreground="light" data-navigation-bar-foreground={fullscreen ? 'light' : 'dark'}>
            <div ref={headerRef} className="bili-detail-header w-full bg-black pt-10 shrink-0"
                style={{ height: detailHeaderHeight, overflow: fullscreen ? 'visible' : 'hidden' }}
                inert={showMenu || showCoinDialog || showFavSheet || commentPanelOpen}>
                <div className="w-full h-full">
                    <VideoPlayer key={`${getPlaybackEntryKey(location)}:${video.id}`} videoId={video.id} cover={video.cover} title={video.title}
                        duration={parseVideoDuration(video.duration)} fullscreen={fullscreen} compact={header.compact && !fullscreen} tab={activeTab}
                        fullscreenProps={fullscreenProps} onNaturalEnd={() => setQueueEndPending(true)} onPlaybackInteraction={() => setQueueEndPending(false)} />
                </div>
            </div>
            <div data-bili-detail-content className="flex-1 min-h-0 flex flex-col" inert={fullscreen || commentPanelOpen} aria-hidden={fullscreen || commentPanelOpen ? true : undefined} style={{ visibility: fullscreen ? 'hidden' : undefined }}>
            {/* 2. Tab 栏 (Sticky)：top = pt-10 + 16:9 区高度，与上方播放器同宽（cqw），勿用 vw */}
            <div className="bili-detail-tabs shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-app-surface z-40">
                <div className="flex gap-6 relative">
                    <button
                        {...bindTap('video.tab.switch', { params: { tab: 'intro' } })}
                        className={`text-[15px] font-medium transition-colors ${activeTab === 'intro' ? 'text-app-primary' : 'text-gray-600'}`}
                    >
                        简介
                    </button>
                    <button
                        {...bindTap('video.tab.switch', { params: { tab: 'comment' } })}
                        className={`text-[15px] font-medium transition-colors ${activeTab === 'comment' ? 'text-app-primary' : 'text-gray-600'}`}
                    >
                        评论 <span className="text-xs font-normal">{commentCount}</span>
                    </button>

                    {/* Animated Indicator */}
                    <div
                        className="absolute bottom-[-13px] h-0.5 bg-app-primary rounded-full"
                        style={{
                            width: '16px',
                            transform: `translateX(${activeTab === 'intro' ? '0px' : '62px'})`,
                            transition: 'all var(--app-duration-medium) var(--app-easing-decelerate)',
                        }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-gray-100 px-3 py-1.5 rounded-full text-xs text-gray-400 w-28 text-center">
                        点我发弹幕
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <span className="text-xs">弹</span>
                    </div>
                </div>
            </div>

            {/* 3. 内容滚动区 (评论 Tab 时 pb-14 给底部留白) */}
            <VideoDetailScroll ready={headerWidth > 0 && (activeTab !== 'comment' || commentSource.ready)} suspended={fullscreen || commentPanelOpen} collapseMax={header.maxCollapse} collapseOffset={header.collapse} onScrollTop={reportDetailScroll} className={`bili-detail-scroll flex-1 overflow-y-auto no-scrollbar min-h-0 ${activeTab === 'comment' ? 'pb-14' : 'pb-0'}`}>
                {activeTab === 'intro' ? (
                    <div className="p-4">
                        {/* UP 主信息栏 */}
                        <div className="flex items-center justify-between mb-4">
                            <div
                                className="flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity"
                                {...(mid ? bindTap('user.open', { params: { mid: String(mid) } }) : {})}
                            >
                                <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-100">
                                    <img src={upInfo.face} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-medium text-app-primary">{upInfo.name}</span>
                                    <span className="text-[10px] text-gray-400">{realFans}粉丝 {realVideoCount}视频</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button className="h-7 px-3 rounded-full bg-app-surface border border-app-primary text-app-primary flex items-center justify-center gap-0.5 font-medium text-[12px] active:bg-app-primary/5 transition-colors">
                                    <Zap size={12} fill="currentColor" /> 充电
                                </button>
                                {isFollowed ? (
                                    <button
                                        className="h-7 px-3 rounded-full bg-[#E3E5E7] text-[#61666D] flex items-center justify-center gap-1 font-medium text-[12px] active:bg-[#d0d3d6] transition-colors"
                                        {...bindTap('video.menu.open')}
                                    >
                                        <Menu size={12} /> 已关注
                                    </button>
                                ) : (
                                    <button
                                        className="bg-app-primary text-white text-[12px] px-4 py-1.5 rounded-full flex items-center gap-0.5 font-medium active:bg-app-primary/90"
                                        {...(mid
                                            ? bindTap(
                                                { kind: 'action', id: 'video.intro.follow.submit' },
                                                {
                                                    onTrigger: () => {
                                                        toggleFollow(String(mid));
                                                        setShowSuggestionPanel(true);
                                                    },
                                                },
                                            )
                                            : {})}
                                    >
                                        <Plus size={12} strokeWidth={3} /> 关注
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Suggestion Panel */}
                        {showSuggestionPanel && (
                            <div className="mb-4">
                                <div className="flex justify-between items-center text-[12px] text-app-text-muted mb-2">
                                    <span>你可能感兴趣</span>
                                    <button
                                        type="button"
                                        {...bindTap(
                                            { kind: 'action', id: 'video.intro.suggestions.close' },
                                            { onTrigger: () => setShowSuggestionPanel(false) },
                                        )}
                                        className="text-app-text-muted active:opacity-70"
                                        aria-label="关闭"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                    {BILIBILI_CONFIG.recommendedUp.map(up => {
                                        const isUpFollowed = isFollowing(up.id);
                                        const author = AUTHOR_DATA[Number(up.id)];
                                        const face = (author as any)?.face || '';
                                        const label =
                                            (author as any)?.official?.title ||
                                            (author as any)?.sign ||
                                            'UP主';
                                        return (
                                            <div
                                                key={up.name}
                                                {...bindTap('user.open', { params: { mid: up.id } })}
                                                className="w-(--app-suggestion-card-width) bg-app-surface border border-[#E3E5E7] rounded-lg p-2 flex flex-col items-center shrink-0 relative shadow-sm active:opacity-90"
                                            >
                                                {face ? (
                                                    <img referrerPolicy="no-referrer" src={face} className="w-9 h-9 rounded-full mb-1.5 object-cover" loading="lazy" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full mb-1.5 bg-gradient-to-br from-sky-100 to-pink-100" />
                                                )}
                                                <div className="text-[12px] font-medium text-app-text mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{up.name}</div>
                                                <div className="text-[9px] text-app-text-muted mb-2 scale-90">{label}</div>
                                                <button
                                                    className={`w-full h-6 rounded-full text-[11px] flex items-center justify-center font-medium transition-colors ${isUpFollowed
                                                        ? 'bg-[#E3E5E7] text-app-text-muted'
                                                        : 'border border-app-primary text-app-primary active:bg-pink-50'
                                                        }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFollow(up.id);
                                                    }}
                                                >
                                                    {isUpFollowed ? '已关注' : '+ 关注'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 广告 Banner 模拟 (from screenshot) */}
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg mb-4">
                            <div className="w-10 h-10 rounded bg-gradient-to-br from-sky-100 to-pink-100 flex items-center justify-center text-app-primary">
                                <Zap size={18} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-medium text-gray-800">不会做的题？千问帮你看看</div>
                                <div className="text-[10px] text-gray-400">广告 · 22.8万播放</div>
                            </div>
                            <button className="text-gray-300"><MoreHorizontal size={14} className="rotate-90" /></button>
                        </div>

                        {/* 视频标题与详情 */}
                        {/* 视频标题与详情 */}
                        <div className="mb-4">
                            <div className="flex justify-between items-start gap-2">
                                <h1 className={`text-[16px] font-medium text-app-text leading-snug ${isExpanded ? '' : 'line-clamp-2'}`}>
                                    {video.title}
                                </h1>
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="pt-0.5 text-gray-400 flex-shrink-0"
                                >
                                    <ChevronDown size={20} className={`${isExpanded ? 'rotate-180' : ''}`} style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1.5 mt-2 text-xs text-gray-400">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1"><MonitorPlay size={12} /> {formatStat(video.plays)}</div>
                                    <div className="flex items-center gap-1"><BilibiliDanmakuIcon className="mt-0.5" /> {formatStat(video.danmaku)}</div>
                                    <span>{formatDate(video.raw?.pubdate || video.date)}</span>
                                    <span>{VIDEO_ONLINE[bvid ?? ''] || '0'}人正在看</span>
                                </div>
                            </div>

                            <div className={`grid ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`} style={{ transition: 'all var(--app-duration-medium) var(--app-easing-standard)' }}>
                                <div className="overflow-hidden">
                                    <div className="text-xs text-gray-500 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <span>{bvid}</span>
                                            {video.raw?.rights?.no_reprint === 1 && (
                                                <div className="flex items-center gap-1">
                                                    <Ban size={11} className="text-[#FF6699]" />
                                                    <span>未经作者授权禁止转载</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="leading-relaxed whitespace-pre-wrap select-text">
                                            {video.desc || '-'}
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {(VIDEO_TAGS[bvid ?? ''] || []).map(tag => (
                                                <span key={tag} className="bg-app-bg text-gray-500 px-2 py-1 rounded-full text-[11px]">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 一键三连操作栏 */}
                        <div className="flex items-center justify-around px-2 py-4 mb-2 select-none">
                            {/* Like & Long Press (triple) */}
                            <div
                                data-action="video.intro.like.toggle"
                                data-action-type="tap"
                                className="flex flex-col items-center gap-1.5 cursor-pointer relative active:scale-95 transition-transform select-none"
                                onPointerDown={handleLikeStart}
                                onPointerUp={handleLikeEnd}
                                onPointerLeave={handleLikeCancel}
                                onPointerCancel={handleLikeCancel}
                            >
                                <div className="relative w-7 h-7 flex items-center justify-center">
                                    <ThumbsUp
                                        size={24}
                                        className={`transition-colors ${liked ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={liked ? 0 : 1.5}
                                    />
                                    {liked && <div className="absolute inset-0 flex items-center justify-center animate-ping opacity-20"><ThumbsUp size={24} className="fill-[#FB7299] text-app-primary" /></div>}
                                </div>
                                <span className={`text-[11px] font-medium ${liked ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {formatStat((stats.likes ?? 0) + (liked ? 1 : 0)) || '点赞'}
                                </span>
                            </div>

                            {/* Dislike */}
                            <div
                                className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                                {...bindTap(
                                    { kind: 'action', id: 'video.intro.dislike.toggle' },
                                    { onTrigger: () => toggleDislike(video!.id) },
                                )}
                            >
                                <div className="w-7 h-7 flex items-center justify-center">
                                    <ThumbsDown
                                        size={24}
                                        className={`transition-colors ${disliked ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={disliked ? 0 : 1.5}
                                    />
                                </div>
                                <span className={`text-[11px] font-medium ${disliked ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {disliked ? '不喜欢' : '不喜欢'}
                                </span>
                            </div>

                            {/* Coin */}
                            <div
                                className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                                {...bindTap(
                                    { kind: 'action', id: 'video.intro.coin.open' },
                                    { onTrigger: handleCoinClick },
                                )}
                            >
                                <div className="relative w-7 h-7 flex items-center justify-center">
                                    {longPressProgress > 0 && (
                                        <svg className="absolute inset-[-6px] w-[40px] h-[40px] rotate-[-90deg] pointer-events-none" viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#FB7299"
                                                strokeWidth="2.5"
                                                strokeDasharray={`${longPressProgress}, 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    )}
                                    <CircleDollarSign
                                        size={24}
                                        className={`transition-colors ${coined ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={coined ? 0 : 1.5}
                                    />
                                </div>
                                <span className={`text-[11px] font-medium ${coined ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {formatStat((stats.coins ?? 0) + coinCount) || '投币'}
                                </span>
                            </div>

                            {/* Fav */}
                            <div
                                className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                                {...bindLongPress(
                                    { kind: 'action', id: 'video.intro.fav.longPress' },
                                    {
                                        onTrigger: () => handleOpenFavSheet(),
                                    },
                                )}
                                onClick={() => handleFav()}
                                data-action="video.intro.fav.toggle"
                            >
                                <div className="relative w-7 h-7 flex items-center justify-center">
                                    {longPressProgress > 0 && (
                                        <svg className="absolute inset-[-6px] w-[40px] h-[40px] rotate-[-90deg] pointer-events-none" viewBox="0 0 36 36">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#FB7299"
                                                strokeWidth="2.5"
                                                strokeDasharray={`${longPressProgress}, 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                    )}
                                    <Star
                                        size={24}
                                        className={`transition-colors ${favored ? 'fill-[#FB7299] text-app-primary' : 'text-[#61666D]'}`}
                                        strokeWidth={favored ? 0 : 1.5}
                                    />
                                </div>
                                <span className={`text-[11px] font-medium ${favored ? 'text-app-primary' : 'text-[#61666D]'}`}>
                                    {formatStat((stats.favs ?? stats.favorites ?? 0) + (favored ? 1 : 0)) || '收藏'}
                                </span>
                            </div>

                            {/* Share */}
                            <div className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform">
                                <div className="w-7 h-7 flex items-center justify-center">
                                    <Share2 size={24} className="text-[#61666D]" strokeWidth={1.5} />
                                </div>
                                <span className="text-[11px] text-[#61666D] font-medium">{formatStat(stats?.shares ?? 0) || '分享'}</span>
                            </div>
                        </div>

                        {/* Toast Overlay */}
                        {toast.show && (
                            <div className="fixed top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-5 py-2.5 rounded-lg text-[13px] z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                                {toast.msg}
                            </div>
                        )}

                        {/* 更多推荐 */}
                        <div className="border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium">相关推荐</span>
                            </div>

                            <div className="flex flex-col gap-3">
                                {relatedVideos.map(v => (
                                    <div
                                        key={v.id}
                                        className="flex gap-3 h-20 relative cursor-pointer active:opacity-70 transition-opacity"
                                        {...bindTap('video.open.fromVideo', { params: { bvid: v.id } })}
                                    >
                                        <div className="relative w-36 h-full rounded-md bg-gray-200 overflow-hidden flex-shrink-0">
                                            <img src={v.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                                            <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/40 px-1 rounded">
                                                {v.duration}
                                            </div>
                                        </div>
                                        <div className="flex flex-col py-0.5 flex-1 min-w-0 gap-0.5">
                                            <h3 className="text-[13px] font-medium line-clamp-2 leading-tight text-app-text pr-6">
                                                {v.title}
                                            </h3>
                                            <div className="text-[11px] text-gray-400 flex flex-col gap-0.5 mt-auto">
                                                <div className="flex items-center gap-1">
                                                    <span className="border border-app-border rounded px-0.5 text-[9px] scale-90 origin-left">UP</span>
                                                    {v.author}
                                                </div>
                                                <div>{formatStat(v.plays)}播放 · {formatStat(v.danmaku)}弹幕</div>
                                            </div>
                                        </div>
                                        <div className="absolute top-0 right-0 py-1">
                                            <MoreHorizontal size={14} className="text-gray-300 rotate-90" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <BilibiliCommentList video={video} source={commentSource} revealId={commentRevealId} blocked={commentPanelOpen}/>
                )}
            </VideoDetailScroll>

            {activeTab === 'comment' && <BilibiliCommentEntry video={video} source={commentSource}/>}
            </div>
            {commentPanelOpen && <BilibiliCommentOverlay video={video} source={commentSource} onSaved={setCommentRevealId} headerHeight={detailHeaderHeight}/>}

            {/* Fav Toast & Sheet */}
            <FavToast visible={showFavToast && !showMenu} onModify={handleOpenFavSheet} />
            <FavSheet
                visible={showFavSheet}
                videoId={video!.id}
                onClose={() => { setShowFavSheet(false); setPendingFolderId(null); }}
                onCreateFolder={handleCreateFolderFromSheet}
                pendingNewFolderId={pendingFolderId}
            />

            {/* Coin Dialog */}
            {showCoinDialog && (() => {
                const maxAdd = Math.min(2 - coinCount, Math.floor(biliUser.coins));
                return (
                    <div 
                        ref={coinDialogRef}
                        className="fixed inset-0 z-[200] flex flex-col overflow-hidden touch-none"
                        onWheel={e => e.stopPropagation()}
                    >
                        {/* Upper half: tap to close */}
                        <div className="flex-1" {...bindBack()} />
                        
                        {/* Lower half: content area with swipe + bottom bar */}
                        <div
                            className="relative pb-[28%]"
                            onPointerDown={handleCoinPointerDown}
                            onPointerMove={handleCoinPointerMove}
                            onPointerUp={handleCoinPointerUp}
                            onPointerCancel={handleCoinPointerUp}
                        >
                            {/* Invisible scroll trap: let sim swipe hit this instead of the page below */}
                            <div className="absolute inset-0 overflow-scroll" aria-hidden="true">
                                <div className="w-[calc(100%+240px)] h-[calc(100%+240px)]" />
                            </div>

                            <div className="relative z-10 flex flex-col items-center select-none touch-none">
                                {/* Coins block container */}
                                <div className="flex items-center gap-4 mb-4">
                                    <ChevronLeft size={36} className="text-white/60 cursor-pointer active:opacity-60" strokeWidth={1.5} onClick={(e) => { e.stopPropagation(); setCoinDialogSelected(1); }} />

                                    <div className="flex items-end gap-5">
                                        {/* 1 Coin Block */}
                                        <div
                                            className={`relative rounded-xl border-[2px] border-[#A86B3E] bg-[#C28253] flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                coinDialogSelected === 1 ? 'w-[104px] h-[104px]' : 'w-[88px] h-[88px] opacity-90'
                                            }`}
                                            onClick={() => setCoinDialogSelected(1)}
                                        >
                                            {/* 4 dots */}
                                            <div className="absolute top-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute top-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />

                                            {/* Coin Icon */}
                                            <div className={`rounded-full bg-gradient-to-b from-[#E8E8E8] to-[#BDBDBD] border border-[#999] flex items-center justify-center shadow-inner mb-1.5 ${coinDialogSelected === 1 ? 'w-11 h-11' : 'w-9 h-9'}`}>
                                                <span className={`text-[#666] font-bold ${coinDialogSelected === 1 ? 'text-[15px]' : 'text-[13px]'}`}>币</span>
                                            </div>
                                            <span className={`text-white font-medium ${coinDialogSelected === 1 ? 'text-[15px]' : 'text-[13px]'}`}>1 硬币</span>
                                        </div>

                                        {/* 2 Coin Block */}
                                        <div
                                            className={`relative rounded-xl border-[2px] border-[#A86B3E] bg-[#C28253] flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                coinDialogSelected === 2 ? 'w-[104px] h-[104px]' : 'w-[88px] h-[88px] opacity-90'
                                            }`}
                                            onClick={() => setCoinDialogSelected(2)}
                                        >
                                            {/* 4 dots */}
                                            <div className="absolute top-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute top-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 left-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />
                                            <div className="absolute bottom-2 right-2 w-[5px] h-[5px] rounded-full bg-[#A86B3E]" />

                                            {/* Two Coins Icon */}
                                            <div className={`relative mb-1.5 ${coinDialogSelected === 2 ? 'w-14 h-11' : 'w-11 h-9'}`}>
                                                <div className={`absolute top-0 left-0 rounded-full bg-gradient-to-b from-[#E8E8E8] to-[#BDBDBD] border border-[#999] flex items-center justify-center shadow-inner ${coinDialogSelected === 2 ? 'w-11 h-11' : 'w-9 h-9'}`}>
                                                    <span className={`text-[#666] font-bold ${coinDialogSelected === 2 ? 'text-[15px]' : 'text-[13px]'}`}>币</span>
                                                </div>
                                                <div className={`absolute top-0 right-0 rounded-full bg-gradient-to-b from-[#E8E8E8] to-[#BDBDBD] border border-[#999] flex items-center justify-center shadow-inner ${coinDialogSelected === 2 ? 'w-11 h-11' : 'w-9 h-9'}`}>
                                                    <span className={`text-[#666] font-bold ${coinDialogSelected === 2 ? 'text-[15px]' : 'text-[13px]'}`}>币</span>
                                                </div>
                                                {/* Sparkles if selected */}
                                                {coinDialogSelected === 2 && (
                                                    <>
                                                        <div className="absolute -top-1 -right-2 text-white text-[12px] rotate-12 z-10">✨</div>
                                                        <div className="absolute -bottom-1 -left-2 text-white text-[10px] -rotate-12 z-10">✨</div>
                                                    </>
                                                )}
                                            </div>
                                            <span className={`text-white font-medium ${coinDialogSelected === 2 ? 'text-[15px]' : 'text-[13px]'}`}>2 硬币</span>
                                        </div>
                                    </div>
                                    
                                    <ChevronRight size={36} className="text-white/60 cursor-pointer active:opacity-60" strokeWidth={1.5} onClick={(e) => { e.stopPropagation(); setCoinDialogSelected(2); }} />
                                </div>

                                {/* 22娘 & Text (Clickable to submit, swipe-up to submit) */}
                                <div
                                    className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform mt-2 touch-none"
                                    onPointerDown={handleMascotPointerDown}
                                    onPointerMove={handleMascotPointerMove}
                                    onPointerUp={handleMascotPointerUp}
                                    onPointerCancel={handleMascotPointerUp}
                                    {...bindTap(
                                        { kind: 'action', id: 'video.intro.coinDialog.submit' },
                                        { onTrigger: handleCoinSubmit },
                                    )}
                                >
                                    <img
                                        src={coinMascotImg}
                                        alt="22娘"
                                        className="w-[100px] h-[160px] object-contain pointer-events-none"
                                        draggable={false}
                                    />

                                    <div className="text-white text-[15px] mb-1.5">上划或点击22娘投硬币</div>
                                    <div className="text-white/60 text-[13px]">硬币余额：{biliUser.coins.toFixed(1)}</div>
                                </div>
                                {/* Bottom Bar */}
                                <div className="w-full px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-4 flex items-center justify-between text-white">
                                    <div
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={() => setCoinDialogAlsoLike(!coinDialogAlsoLike)}
                                    >
                                        <div className={`w-[18px] h-[18px] rounded-[3px] border-[1.5px] flex items-center justify-center transition-colors ${
                                            coinDialogAlsoLike ? 'bg-white border-white' : 'border-white/70'
                                        }`}>
                                            {coinDialogAlsoLike && <Check size={13} className="text-[#333]" strokeWidth={4} />}
                                        </div>
                                        <span className="text-[15px] tracking-wide">同时点赞内容</span>
                                    </div>

                                    <div className="flex items-center gap-2 cursor-pointer active:opacity-70">
                                        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-white/70 flex items-center justify-center" {...bindBack()}>
                                            <X size={11} strokeWidth={2.5} className="text-white/90" />
                                        </div>
                                        <span className="text-[14px] text-white/90">如何获取硬币？</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background overlay */}
                        <div className="absolute inset-0 bg-black/70 -z-10 pointer-events-none" />
                    </div>
                );
            })()}

            {/* Unfollow Menu */}
            {showMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/50" {...bindBack()} />
                    <div className="bg-app-surface rounded-t-xl z-20 overflow-hidden text-[15px]">
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" {...bindBack()}>加入特别关注</div>
                        <div className="py-3.5 text-center text-app-text border-b border-gray-100 active:bg-gray-50" {...bindBack()}>设置分组</div>
                        <div
                            className="py-3.5 text-center text-app-primary border-b border-gray-100 active:bg-gray-50"
                            {...bindBack({ beforeTrigger: () => toggleFollow(String(mid || '')) })}
                        >
                            取消关注
                        </div>
                        <div className="h-1.5 bg-app-bg" />
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" {...bindBack()}>取消</div>
                    </div>
                </div>
            )}
        </div>
    );
};
