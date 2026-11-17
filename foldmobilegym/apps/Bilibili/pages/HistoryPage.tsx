import React from 'react';
import { IcNavBack, IcMonitorPlay } from '../res/icons';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
import { useVideos } from '../hooks/useData';
import { useLocale } from '../locale';
import { formatHistoryVisit } from '../utils/historyTime';
import { useBilibiliStore } from '../state';
import { useBilibiliEntryOwner } from '../hooks/useBilibiliEntryOwner';

/** Local simulated visits, not a remote account's watch history. */
export const HistoryPage: React.FC = () => {
    const strings = useBilibiliStrings();
    const { bindBack, bindTap } = useBilibiliGestures();
    const ids = useBilibiliStore(s => s.user.videoHistory);
    const times = useBilibiliStore(s => s.user.videoHistorySeenAt);
    const locale = useLocale();
    const remove = useBilibiliStore(s => s.removeVideoVisit);
    const ownsEntry = useBilibiliEntryOwner();
    const videos = useVideos();
    const byId = new Map(videos.map(video => [video.id, video]));
    return (
        <div className="flex flex-col h-full bg-app-surface text-app-text">
            <header className="shrink-0 border-b border-app-bg">
                <div className="h-10" />
                <div className="relative flex items-center justify-center px-4 pb-3">
                    <button type="button" {...bindBack()} aria-label={strings.favorite_folder_back} className="absolute left-4"><IcNavBack size={24} /></button>
                    <h1 className="text-[17px] font-bold">{strings.history_title}</h1>
                </div>
                <div className="px-4 pb-3 text-[12px] text-app-text-muted">{strings.history_note}</div>
            </header>
            <div className="flex-1 overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
                {(ids || []).map(id => {
                    const video = byId.get(id);
                    const time = formatHistoryVisit(times?.[id], locale) || strings.history_time_unknown;
                    return (
                        <div key={id} className="flex items-center gap-2 px-4 py-3 border-b border-app-bg">
                            {video ? (
                                <button type="button" {...bindTap('video.open', { params: { bvid: id } })} className="flex flex-1 min-w-0 gap-3 text-left">
                                    <img src={video.cover} alt="" referrerPolicy="no-referrer" className="w-[140px] aspect-video rounded object-cover bg-app-bg shrink-0" />
                                    <span className="flex flex-col min-w-0 justify-between py-0.5">
                                        <span className="text-[14px] line-clamp-2">{video.title}</span>
                                        <span className="text-[11px] text-app-text-muted"><span className="flex items-center gap-1"><IcMonitorPlay size={12} />{video.author || strings.favorite_author_fallback}</span><span data-history-time>{time}</span></span>
                                    </span>
                                </button>
                            ) : <div className="flex-1 min-w-0 text-[14px] text-app-text-muted">{strings.history_unavailable}<div data-history-time className="text-[11px]">{time}</div></div>}
                            <button type="button" {...bindTap({ kind: 'action', id: 'history.item.remove' }, { params: { videoId: id }, onTrigger: () => { if (ownsEntry()) remove(id); } })}
                                aria-label={video ? `${strings.history_remove}: ${video.title}` : strings.history_remove}
                                className="shrink-0 px-2 py-2 text-[12px] text-app-text-muted">{strings.history_remove}</button>
                        </div>
                    );
                })}
                {!ids?.length && <p className="pt-24 text-center text-[14px] text-app-text-muted">{strings.history_empty}</p>}
            </div>
        </div>
    );
};
