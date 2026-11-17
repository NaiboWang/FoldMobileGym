import {SIMULATOR_CONFIG} from '../../../os/data/simulatorConfig';
import {useShelfDialogFocus} from '../hooks/useShelfDialogFocus';
import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
    IcNavBack,
    IcMore,
    IcShare,
    IcUser,
    IcSparkles,
} from '../res/icons';
import { dimens } from '../res/dimens';
import { WECHAT_READING_CONFIG } from '../data';
import { useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { WechatReadingDownloadIcon, WechatReadingFolderIcon, WechatReadingBookshelfIcon } from '../res/icons';
import {detailShelfEntry,detailPrivacyCommand} from '../utils/bookDetailPrivacy';
import {resolveDetailBook,recordedBookMinutes,detailReviewWidths} from '../utils/bookDetailModel';
import {useBookDetailInteractionOwner} from '../hooks/useBookDetailInteractionOwner';
import { useLocale } from '../../../os/locale';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import {
    formatWechatReadingCount,
    formatWechatReadingWords,
} from '../utils/localization';

export const BookDetailPage: React.FC = () => {
    const { bookId } = useParams();
    const location = useLocation();
    const addToBookshelf = useWechatReadingStore(s => s.addToBookshelf);
    const removeFromShelf = useWechatReadingStore(s => s.removeFromShelf);
    const setPrivate = useWechatReadingStore(s => s.togglePrivate);
    const shelf = useWechatReadingStore(s => s.shelf);
    const book = resolveDetailBook(bookId, WECHAT_READING_CONFIG.store, WECHAT_READING_CONFIG.audiobooks);
    const owns = useBookDetailInteractionOwner();
    const records = useWechatReadingStore(st => st.readingRecords);
    const { bindBack: rawBindBack, bindTap, back, go } = useWechatReadingGestures();
    const locale = useLocale();
    const s = useWechatReadingStrings();

    const searchParams = new URLSearchParams(location.search);
    const showShelfModal = searchParams.get('modal') === 'shelf';
    const {rootRef,openerRef,trapFocus,active:dialogActive}=useShelfDialogFocus(showShelfModal,location.pathname,location.key,'bookDetail');

    const bindBack = <T extends HTMLElement>() => {
        const binding = rawBindBack<T>();
        return {...binding, onClick: (event:React.MouseEvent<T>) => { if(owns()) binding.onClick?.(event); }};
    };
    const isInShelf = shelf.some(item => item.bookId === bookId);
    const shelfEntry = detailShelfEntry(bookId,shelf);
    const privacyTarget = shelfEntry?.isPrivate !== true;

    if (!book) return <div className="h-full flex flex-col items-center justify-center gap-4" data-reading-book-unavailable>
        <p role="status">{s.book_detail_missing}</p><button {...bindBack()}>{s.reader_load_back}</button>
    </div>;
    const introText = book.intro ?? '';
    const minutes = book.isAudio ? null : recordedBookMinutes(records, book.id);
    const reviewWidths = detailReviewWidths(book);
    const readingCount = book.isAudio ? book.plays : book.totalReads;
    const canChangeShelf = () => owns() && !book.isAudio && book.id === bookId;

    return (
        <div ref={rootRef} data-reading-book-detail={book.id} className="w-full h-full bg-(--app-c-book-detail-page-bg-fafa) flex flex-col relative overflow-hidden">
            <div className="flex flex-col h-full min-h-0" inert={showShelfModal}>
            <div className="flex items-center justify-between px-4 py-2 pt-12 bg-transparent z-10">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2 text-(--app-c-tw-text-gray-700) active:opacity-60">
                    <IcNavBack size={dimens.book_detail_nav_back_icon_size} />
                </button>
                <div className="flex gap-4 text-(--app-c-tw-text-gray-700)">
                    <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed p-1"><span className="text-xs font-bold border border-(--app-c-tw-border-gray-700)/30 rounded px-1">{book.isMembership ? s.book_detail_paid : s.book_detail_unknown}</span></button>
                    <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed p-1"><span className="text-base font-bold">{s.book_detail_listen}</span></button>
                    <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed p-1 flex items-center gap-0.5"><IcUser size={dimens.icSizeNav} /><span className="text-xs scale-75">{s.book_detail_unknown}</span></button>
                    <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed p-1"><IcShare size={dimens.icSizeToolbar} /></button>
                    <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed p-1"><IcMore size={dimens.icSizeToolbar} /></button>
                </div>
            </div>

            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar pb-24">
                <div className="px-4 pt-4">
                    <div className="flex gap-5 mb-8">
                        <div className={`w-28 aspect-[2/3] shrink-0 rounded shadow-md relative overflow-hidden ${book.coverColor || 'bg-(--app-c-tw-bg-gray-200)'}`}>
                            {book.cover ? (
                                <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 p-3 flex flex-col items-center justify-center text-center">
                                    <span className="text-sm font-bold opacity-90 text-(--app-c-tw-text-slate-900)">{book.title}</span>
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) mt-1">{book.author}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col pt-1">
                            <h1 className="text-2xl font-bold text-(--app-c-tw-text-gray-900) font-serif mb-1">{book.title}</h1>
                            <div className="text-(--app-c-tw-text-blue-500) text-sm mb-3 font-medium">{book.author} &gt;</div>

                            <p className="text-xs text-(--app-c-tw-text-gray-500) leading-relaxed line-clamp-3">
                                {introText || s.book_detail_unknown}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between items-start mb-8 px-2">
                        <div className="flex flex-col items-center flex-1">
                            <div className="text-xs text-(--app-c-tw-text-gray-400) mb-1">{book.isAudio ? s.book_detail_stat_listening : s.book_detail_stat_reading}</div>
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">
                                {formatWechatReadingCount(readingCount, locale)}
                                {book.isAudio ? s.book_detail_stat_times : s.book_detail_stat_person}
                            </div>
                        </div>
                        <div className="w-(--app-comp-header-width-1) h-8 bg-(--app-c-tw-bg-gray-200) mt-2" />
                        <div className="flex flex-col items-center flex-1">
                            <div className="text-xs text-(--app-c-tw-text-gray-400) mb-1">{book.isAudio ? s.book_detail_my_listening : s.book_detail_my_reading}</div>
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">
                                <span data-reading-book-minutes={minutes ?? ''}>{minutes === null ? s.book_detail_unknown : `${minutes} ${s.common_minutes_unit}`}</span>
                            </div>
                            <div className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) mt-1 flex items-center gap-0.5">
                                <span>{s.book_detail_recorded_time}</span>
                            </div>
                        </div>
                        <div className="w-(--app-comp-header-width-1) h-8 bg-(--app-c-tw-bg-gray-200) mt-2" />
                        <div className="flex flex-col items-center flex-1">
                            <div className="text-xs text-(--app-c-tw-text-gray-400) mb-1">{book.isAudio ? s.book_detail_rating : s.book_detail_word_count}</div>
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">{book.isAudio ? book.rating : formatWechatReadingWords(book.totalWords, locale)}</div>
                        </div>
                    </div>

                    <div className="bg-app-surface rounded-xl p-5 shadow-sm mb-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="text-lg font-bold text-(--app-c-tw-text-gray-800)">{s.book_detail_weread_recommendation} {book.recommendedValue === undefined ? s.book_detail_unknown : `${book.recommendedValue}%`}</div>
                            <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-(--app-c-tw-text-gray-500) border border-app-border rounded-full px-3 py-1">{s.book_detail_write_review}</button>
                        </div>

                        <div className="flex items-center gap-4 mb-5">
                            {book.masterpiece && (
                                <div className="flex items-center gap-1">
                                    <span className="text-(--app-c-book-detail-page-text-d1a0) text-2xl font-bold font-serif">{s.book_detail_masterpiece}</span>
                                    <div className="text-(--app-c-book-detail-page-text-d1a0) transform rotate-45 border-l-2 border-b-2 border-(--app-c-book-detail-page-border-d1a0) w-2.5 h-2.5 ml-0.5 mt-1" />
                                </div>
                            )}

                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) w-16 text-right">{s.book_detail_recommend}</span>
                                    <div className="flex-1 h-1.5 bg-(--app-c-tw-bg-gray-100) rounded-full overflow-hidden">
                                        <div style={{width:`${reviewWidths?.recommended ?? 0}%`}} className="h-full bg-(--app-c-tw-bg-gray-500) rounded-full" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) w-16 text-right">{s.book_detail_average}</span>
                                    <div className="flex-1 h-1.5 bg-(--app-c-tw-bg-gray-100) rounded-full overflow-hidden">
                                        <div style={{width:`${reviewWidths?.average ?? 0}%`}} className="h-full bg-(--app-c-tw-bg-gray-300) rounded-full" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-gray-400) w-16 text-right">{s.book_detail_not_recommend}</span>
                                    <div className="flex-1 h-1.5 bg-(--app-c-tw-bg-gray-100) rounded-full overflow-hidden">
                                        <div style={{width:`${reviewWidths?.notRecommended ?? 0}%`}} className="h-full bg-(--app-c-tw-bg-gray-200) rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <span className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{s.book_detail_tag_all}({formatWechatReadingCount(book.totalReviews, locale)})</span>
                            <span className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{s.book_detail_recommend}({formatWechatReadingCount(book.reviewBreakdown?.recommended, locale)})</span>
                            <span className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{s.book_detail_average}({formatWechatReadingCount(book.reviewBreakdown?.average, locale)})</span>
                            <span className="px-3 py-1.5 bg-(--app-c-tw-bg-gray-100) rounded-lg text-xs text-(--app-c-tw-text-gray-600) font-medium">{s.book_detail_not_recommend}({formatWechatReadingCount(book.reviewBreakdown?.notRecommended, locale)})</span>
                            {!reviewWidths && <span>{s.book_detail_unknown}</span>}
                        </div>
                    </div>

                    <div className="bg-app-surface rounded-xl p-5 shadow-sm">
                        <h2>{s.book_detail_intro}</h2>
                        <p data-reading-book-intro={introText} className="text-sm leading-relaxed">{introText || s.book_detail_unknown}</p>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 h-16 bg-app-surface border-t border-(--app-c-tw-border-gray-100) flex items-center px-4 gap-4 z-20 pb-safe">
                <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed w-12 h-10 bg-(--app-c-tw-bg-gray-100) rounded-lg flex items-center justify-center text-(--app-c-tw-text-gray-600)">
                    <IcSparkles size={dimens.icSizeNav} />
                </button>
                {(() => {
                    const shelfButtonProps = isInShelf
                        ? bindTap<HTMLButtonElement>('book.modal.shelf.open', { params: { bookId: bookId! }, beforeTrigger:event=>{if(owns())openerRef.current=event.currentTarget;}, onTrigger: () => {if(canChangeShelf() && !showShelfModal) go('book.modal.shelf.open', {bookId:book.id});} })
                        : bindTap<HTMLButtonElement>(
                            { kind: 'action', id: 'bookDetail.item.shelf.add.submit' },
                            { params: { bookId: bookId! }, onTrigger: () => {if(canChangeShelf() && !showShelfModal) addToBookshelf(book.id);} },
                          );
                    return (
                        <button
                            disabled={book.isAudio} title={book.isAudio ? s.book_detail_unavailable_action : undefined}
                            {...shelfButtonProps}
                            className={`flex-1 h-10 rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed ${isInShelf
                                ? 'bg-(--app-c-tw-bg-gray-100) text-(--app-c-tw-text-gray-400)'
                                : 'bg-(--app-c-tw-bg-gray-100) text-(--app-c-tw-text-gray-800)'
                                }`}
                            style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        >
                            {isInShelf ? s.book_detail_added_to_shelf : s.book_detail_add_to_shelf}
                        </button>
                    );
                })()}
                <button
                    className="flex-1 h-10 bg-app-primary rounded-lg text-white font-bold text-sm active:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                    data-reading-book-read disabled={book.isAudio} title={book.isAudio ? s.book_detail_unavailable_action : undefined}
                    {...bindTap<HTMLButtonElement>('reader.open', { params: { bookId: bookId! }, onTrigger: () => {if(owns() && !showShelfModal && !book.isAudio) go('reader.open',{bookId:book.id});} })}
                >
                    {book.isAudio ? s.book_detail_audio_unavailable : s.book_detail_read_button}
                </button>
            </div>

            </div>
            {showShelfModal && (
                <>
                    <div className="absolute inset-0 bg-black/40 z-40" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }} {...bindBack()} />
                    <div role="dialog" aria-modal={dialogActive} aria-label={s.book_detail_added_to_shelf} tabIndex={-1}
                        onKeyDown={event=>{
                            if(event.key==='Escape'&&!event.repeat&&dialogActive&&owns()){event.preventDefault();event.stopPropagation();back();}
                            else trapFocus(event);
                        }}
                        data-scroll-container="detailShelf" data-scroll-direction="vertical"
                        style={{maxHeight:`calc(100% - ${SIMULATOR_CONFIG.framework.statusBarHeight+8}px)`}}
                        className="absolute bottom-0 left-0 right-0 max-h-full bg-(--app-c-book-detail-page-bg-f7f7) rounded-t-2xl z-50 animate-slide-up overflow-y-auto overscroll-contain pb-safe">
                        <div className="flex flex-col">
                            <button data-reading-book-private disabled={book.isAudio || !shelfEntry || typeof shelfEntry.isPrivate !== 'boolean'}
                                title={!shelfEntry ? s.book_detail_shelf_source_unavailable : undefined}
                                {...bindTap<HTMLButtonElement>({kind:'action',id:'bookDetail.item.privacy.submit'},{
                                    params:{bookId:book.id,isPrivate:privacyTarget},
                                    onTrigger:()=>{
                                        if(!canChangeShelf() || !showShelfModal)return;
                                        const command=detailPrivacyCommand(book.id,shelfEntry,useWechatReadingStore.getState().shelf,privacyTarget);
                                        if(!command)return;
                                        setPrivate([command.bookId],command.isPrivate);
                                        back();
                                    },
                                })}
                                className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-[1px]">
                                <div className="w-6 flex justify-center"><IcUser size={dimens.icSizeNav} className="text-(--app-c-tw-text-gray-600)" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-gray-800)">{privacyTarget ? s.book_detail_shelf_modal_private : s.book_detail_shelf_modal_public}</span>
                            </button>
                            <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-[1px]">
                                <div className="w-6 flex justify-center"><WechatReadingDownloadIcon className="text-(--app-c-tw-text-gray-600)" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-gray-800)">{s.book_detail_shelf_modal_download}</span>
                            </button>
                            <button disabled title={s.book_detail_unavailable_action} className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-[1px]">
                                <div className="w-6 flex justify-center"><WechatReadingFolderIcon className="text-(--app-c-tw-text-gray-600)" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-gray-800)">{s.book_detail_shelf_modal_move}</span>
                            </button>
                            <button disabled={book.isAudio || !shelfEntry}
                                title={!shelfEntry ? s.book_detail_shelf_source_unavailable : undefined}
                                {...bindTap<HTMLButtonElement>(
                                    { kind: 'action', id: 'bookDetail.item.shelf.remove.submit' },
                                    {
                                        params: { bookId: bookId! },
                                        onTrigger: () => {
                                            if(!canChangeShelf() || !showShelfModal || !shelfEntry || detailShelfEntry(book.id,useWechatReadingStore.getState().shelf)!==shelfEntry) return;
                                            removeFromShelf(book.id);
                                            back();
                                        },
                                    },
                                )}
                                className="flex items-center gap-3 px-6 py-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) mb-2"
                            >
                                <div className="w-6 flex justify-center"><WechatReadingBookshelfIcon className="text-red-500" /></div>
                                <span className="text-(--app-settings-item-text-size) font-medium text-red-500">{s.book_detail_shelf_modal_remove}</span>
                            </button>

                            <button
                                data-reading-book-cancel {...bindBack<HTMLButtonElement>()}
                                className="w-full py-4 bg-app-surface text-center text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-gray-800) active:bg-(--app-c-tw-bg-gray-50)"
                            >
                                {s.book_detail_shelf_modal_cancel}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
