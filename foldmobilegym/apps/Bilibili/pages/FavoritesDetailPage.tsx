import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
import { useLocale } from '../locale';
import { formatFavoriteCount } from '../utils/favoriteLocale';
import { formatBilibiliStat } from '../utils/localize';
import { MissingFavoriteFolder } from '../components/MissingFavoriteFolder';
import { UnavailableFavoriteItem } from '../components/UnavailableFavoriteItem';
import { resolveFavoriteEntries } from '../utils/favoriteEntries';
import { createFavoritePreviewQueue } from '../utils/favoritePreviewQueue';
import { parseVideoDuration } from '../utils/videoPlayback';
import React from 'react';
import { IcNavBack, IcSearch, IcMore, IcMoreVertical, IcPlay, IcMonitorPlay, IcMessageSquareText } from '../res/icons';
const ChevronLeft = IcNavBack, Search = IcSearch, MoreHorizontal = IcMore, MoreVertical = IcMoreVertical, Play = IcPlay, MonitorPlay = IcMonitorPlay, MessageSquareText = IcMessageSquareText;
import { UNSAFE_NavigationContext, useLocation, useParams } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import TaskManager from '../../../os/TaskManager';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useVideos } from '../hooks/useData';
// Helper for formatting stats numbers
const formatDuration = (val: number | string | undefined) => {
    if (!val) return '00:00';
    if (typeof val === 'string' && val.includes(':')) return val;

    const seconds = typeof val === 'string' ? parseInt(val) : val;
    if (isNaN(seconds)) return '00:00';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const FavoritesDetailPage: React.FC = () => {
    const strings = useBilibiliStrings();
    const locale = useLocale();
    const { bindBack, bindTap, go } = useBilibiliGestures();
    const { folderId } = useParams();
    const location = useLocation();
    const { navigator } = React.useContext(UNSAFE_NavigationContext);
    const activityId = useActivityId();
    const user = useBilibiliStore(s => s.user);
    const VIDEO_DATA = useVideos();

    // Get folder data
    const folder = user.favoritesFolders?.find(f => f.id === folderId);

    // Get videos
    const entries = resolveFavoriteEntries(folder?.videoIds, VIDEO_DATA);
    const videos = entries.flatMap(entry => entry.video ? [entry.video] : []);

    const previewable = new Set(VIDEO_DATA.filter(video => parseVideoDuration(video.duration) > 0).map(video => video.id));
    const previewQueue = createFavoritePreviewQueue(folder?.videoIds ?? [], previewable);
    const startingPreview = React.useRef(false);

    // Folder cover
    const folderCover = [...videos].reverse().find(video => video.cover)?.cover || folder?.cover;

    if (!folder) return <MissingFavoriteFolder />;

    return (
        <div className="flex flex-col h-full bg-app-surface font-sans relative">
            {/* Header */}
            <div className="sticky top-0 bg-app-surface z-50">
                <div className="h-10" /> {/* Status bar placeholder */}
                <div className="flex items-center justify-between px-4 pb-3">
                    <div className="flex items-center gap-4">
                        <button type="button" {...bindBack()} className="active:opacity-80">
                            <ChevronLeft size={24} className="text-app-text" />
                        </button>
                        {/* Title is hidden in header, shown in body */}
                    </div>
                    <div className="flex items-center gap-5 text-[#61666D]">
                        <Search size={22} />
                        <MoreVertical size={22} />
                    </div>
                </div>
            </div>

            {/* Folder Info Header */}
            <div className="px-4 pb-2">
                <div className="flex gap-3 mb-2">
                    <div className="w-[125px] aspect-video bg-app-bg rounded-[6px] overflow-hidden shrink-0 relative">
                        {folderCover ? (
                            <img src={folderCover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">{strings.favorite_no_cover}</div>
                        )}
                        {/* Optional: Add video count or something on cover if needed, but not in screenshot */}
                    </div>
                    <div className="flex flex-col py-0.5">
                        <h1 className="text-[17px] text-app-text font-medium leading-tight mb-2">{folder.title || strings.favorite_folders}</h1>
                        <div className="text-[12px] text-app-text-muted">{strings.favorite_creator}: {user.name}</div>
                    </div>
                </div>
                {/* Count section */}
                <div className="text-[12px] text-app-text-muted mt-3 pb-2 border-b border-app-bg">
                    {formatFavoriteCount(entries.length, strings)}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pb-20" data-scroll-container="main" data-scroll-direction="vertical">
                {entries.length === 0 && <p className="pt-20 text-center text-[14px] text-app-text-muted">{strings.favorite_empty_folder}</p>}
                {entries.map(({ id, video }, index) => video ? (
                    <div key={`${id}-${index}`} data-favorite-entry-id={id} className="flex gap-3 px-4 py-3 border-b border-app-bg active:bg-gray-50 transition-colors cursor-pointer" {...bindTap('video.open', { params: { bvid: video.id } })}>
                        {/* Thumbnail */}
                        <div className="w-[125px] aspect-video bg-app-bg rounded-[6px] overflow-hidden relative shrink-0">
                            <img src={video.cover} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute bottom-1 right-1 text-white text-[10px] bg-black/40 px-1 rounded flex items-center h-[16px]">
                                {formatDuration(video.duration)}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex flex-col justify-between flex-1 py-0.5 relative">
                            <div className="text-[14px] text-app-text leading-[1.3] line-clamp-2 font-normal">
                                {video.title}
                            </div>

                            <div className="mt-auto">
                                <div className="text-[11px] text-app-text-muted flex items-center gap-1 mb-1">
                                    <span className="border border-[#9499A0]/30 rounded-[2px] px-0.5 text-[9px] scale-90 origin-left">UP</span>
                                    {video.author || strings.favorite_author_fallback}
                                </div>
                                <div className="text-[11px] text-app-text-muted flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <MonitorPlay size={12} className="text-app-text-muted" />
                                        {formatBilibiliStat(video.plays, locale)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageSquareText size={11} className="text-app-text-muted" />
                                        {formatBilibiliStat(video.danmaku || 0, locale)}
                                    </span>
                                </div>
                            </div>

                            {/* Menu Icon (Absolute bottom right of container) */}
                            <div className="absolute bottom-0 right-0 text-app-text-muted p-1 -mr-2 -mb-2">
                                <MoreVertical size={16} />
                            </div>
                        </div>
                    </div>
                ) : <UnavailableFavoriteItem key={`${id}-${index}`} id={id} />)}
            </div>

            {/* Floating Play Button */}
            <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-app-bg px-4 py-3 z-50">
                <button disabled={!previewQueue} {...bindTap('video.open', { params: { bvid: previewQueue?.ids[0] ?? '' }, onTrigger: () => {
                    const os = TaskManager.getState();
                    const live = (navigator as unknown as { location?: { key: string } }).location;
                    const top = os.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
                    if (startingPreview.current || os.isLauncherVisible || os.isRecentsVisible || top?.activityId !== activityId || (live && live.key !== location.key)) return;
                    const liveFolder = useBilibiliStore.getState().user.favoritesFolders?.find(item => item.id === folderId);
                    const nextQueue = liveFolder && createFavoritePreviewQueue(liveFolder.videoIds ?? [], previewable);
                    if (!nextQueue) return;
                    startingPreview.current = true;
                    go('video.open', { bvid: nextQueue.ids[0] }, { state: { bilibiliFavoritePreviewQueue: nextQueue } });
                } })} className="w-full h-10 bg-app-primary text-white rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm disabled:opacity-50">
                    <MonitorPlay size={16} className="fill-white" />
                    <span className="text-[14px] font-medium">{strings.favorite_play_all}</span>
                </button>
            </div>
        </div>
    );
};
