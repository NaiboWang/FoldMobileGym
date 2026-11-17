import React, { useContext,useEffect,useMemo,useRef,useState } from 'react';
import { UNSAFE_NavigationContext,useLocation,useSearchParams } from 'react-router-dom';
import KeyboardService from '../../../os/keyboard/KeyboardService';
import {useActivityId} from '../../../os/ActivityContext';
import {useBookDetailInteractionOwner,isBookDetailForegroundActivity} from '../hooks/useBookDetailInteractionOwner';
import {useSearchViewport} from '../hooks/useSearchViewport';
import type {TransitionId} from '../navigation.declaration';
import '../search-reference.css';
import { IcNavBack, IcClose, IcScan, IcSearch } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { WECHAT_READING_CONFIG } from '../data';
import { BOOK_BADGE_COLOR_MAP } from '../constants';
import { useLocale } from '../../../os/locale';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { formatWechatReadingCount,quoteWechatReadingTitle } from '../utils/localization';
import { splitSearchHighlight } from '../utils/searchHighlight';
import { matchesOwnedBookList } from '../utils/localTextSearch';
import { useLocalTextSearch } from '../hooks/useLocalTextSearch';
import { useWechatReadingStore } from '../state';

const HighlightText: React.FC<{ text: string, highlight: string, className?: string }> = ({ text, highlight, className = '' }) => {
    if (!highlight) return <span className={className}>{text}</span>;
    const parts = splitSearchHighlight(text, highlight);
    return (
        <span className={className}>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase()
                    ? <span key={i} className="text-(--app-c-tw-text-blue-500)">{part}</span>
                    : part
            )}
        </span>
    );
};

type SearchTab = 'all' | 'ebook' | 'audiobook' | 'fulltext' | 'author' | 'booklist';

const SearchPage: React.FC = () => {
    const {bindTap:rawBindTap,bindBack:rawBindBack,go:rawGo}=useWechatReadingGestures();
    const location=useLocation(),activityId=useActivityId(),{navigator}=useContext(UNSAFE_NavigationContext);
    const owns=useBookDetailInteractionOwner(),inputRef=useRef<HTMLInputElement>(null);
    const [searchParams] = useSearchParams();
    const searchText = searchParams.get('query') || '';
    const [draftQuery,setDraftQuery]=useState(searchText),draftRef=useRef(searchText);
    const activeTab = searchParams.get('tab') || 'all';
    const locale = useLocale();
    const s = useWechatReadingStrings();
    const user = useWechatReadingStore(state => state.user);
    const likedListBooks = useWechatReadingStore(state => state.likedListBooks);
    const ownedListTitle = s.book_lists_liked_title.replace('{0}', user.name);
    const textResults = useLocalTextSearch(WECHAT_READING_CONFIG.store, searchText, activeTab === 'fulltext');
    const showOwnedList = activeTab === 'booklist' && matchesOwnedBookList(searchText, ownedListTitle, user.name, likedListBooks, WECHAT_READING_CONFIG.store);
    const viewport=useSearchViewport(location.key,activeTab!=='fulltext'||!textResults.loading);
    useEffect(()=>{
        const live=(navigator as {location?:typeof location}).location??location;
        if(live.key!==location.key)return;
        if(searchText!==draftRef.current){draftRef.current=searchText;setDraftQuery(searchText);}
    },[location,navigator,searchText]);
    const foreground=()=>isBookDetailForegroundActivity(activityId);
    const inputOwns=()=>foreground()&&inputRef.current?.isConnected&&((navigator as {location?:typeof location}).location??location).pathname==='/search';
    const changeQuery=(value:string)=>{if(inputOwns()){draftRef.current=value;setDraftQuery(value);rawGo('search.query.change',{query:value});}};
    const bindTap=<T extends HTMLElement>(id:TransitionId,options?:{params?:Record<string,string|number>;onTrigger?:()=>void})=>{
        const binding=rawBindTap<T>(id,options);
        return {...binding,onClick:(event:React.MouseEvent<T>)=>{if(id==='search.query.change'?inputOwns():owns()){viewport.save();binding.onClick?.(event);if(id!=='search.query.change')KeyboardService.hide();}}};
    };
    const bindBack=()=>{const binding=rawBindBack();return{...binding,onClick:(event:React.MouseEvent<HTMLElement>)=>{if(inputOwns()){viewport.save();binding.onClick?.(event);KeyboardService.hide();}}};};
    const keepPointerStable=(event:React.PointerEvent<HTMLElement>)=>{
        if(event.button===0&&event.isPrimary!==false&&foreground()&&document.activeElement===inputRef.current
            &&(event.target as Element).closest('[data-trigger]'))event.preventDefault();
    };
    // Bubble after the selected control has committed navigation, never on pointer-down.
    const finishSelection=(event:React.MouseEvent<HTMLElement>)=>{
        if(inputOwns()){inputRef.current?.blur();KeyboardService.hide();}
    };


    const hotSearchList = WECHAT_READING_CONFIG.hotSearch;

    const tabs: { id: SearchTab; label: string }[] = [
        { id: 'all', label: s.search_tab_all },
        { id: 'ebook', label: s.search_tab_ebook },
        { id: 'audiobook', label: s.search_tab_audiobook },
        { id: 'fulltext', label: s.search_tab_fulltext },
        { id: 'author', label: s.search_tab_author },
        { id: 'booklist', label: s.search_tab_book_list },
    ];

    const searchResults = useMemo(() => {
        if (!searchText) return { authors: [], books: [], audiobooks: [] };

        const lowerText = searchText.toLowerCase();

        const authors = Array.from(new Set(
            WECHAT_READING_CONFIG.store
                .filter(b => b.author.toLowerCase().includes(lowerText))
                .map(b => b.author)
        )).map(name => ({
            name,
            avatar: 'bg-(--app-c-tw-bg-gray-200)',
            desc: locale === 'en'
                ? `Author | ${quoteWechatReadingTitle(WECHAT_READING_CONFIG.store.find(b => b.author === name)?.title || '', locale)}`
                : `${s.search_author_section} | ${quoteWechatReadingTitle(WECHAT_READING_CONFIG.store.find(b => b.author === name)?.title || '', locale)}`
        }));

        const books = WECHAT_READING_CONFIG.store.filter(b =>
            b.title.toLowerCase().includes(lowerText) ||
            b.author.toLowerCase().includes(lowerText)
        );

        const audiobooks = (WECHAT_READING_CONFIG.audiobooks || []).filter((a: any) =>
            a.title.toLowerCase().includes(lowerText) ||
            (a.author && a.author.toLowerCase().includes(lowerText))
        );

        return { authors, books, audiobooks };
    }, [locale, s.search_author_section, searchText]);

    const showAuthors = activeTab === 'all' || activeTab === 'author';
    const showBooks = activeTab === 'all' || activeTab === 'ebook';
    const showAudiobooks = activeTab === 'all' || activeTab === 'audiobook';
    const hasResults = (showAuthors && searchResults.authors.length > 0)
        || (showBooks && searchResults.books.length > 0)
        || (showAudiobooks && searchResults.audiobooks.length > 0)
        || (activeTab === 'fulltext' && textResults.hits.length > 0)
        || showOwnedList;

    return (
        <div className="wr-search flex flex-col h-full bg-app-surface" data-reading-search>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-12 pb-2 bg-app-surface sticky top-0 z-50">
                <button type="button" aria-label={s.search_back}
                    className="p-1 -ml-2 active:opacity-60" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
                    {...bindBack()}
                >
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-gray-600)" />
                </button>
                <div className="flex-1 h-9 bg-(--app-c-tw-bg-gray-100) rounded-full flex items-center px-3 gap-2">
                    <IcSearch size={dimens.icSizeChevron} className="text-(--app-c-tw-text-gray-400)" />
                    <input ref={inputRef} aria-label={s.search_placeholder_default}
                        type="text"
                        value={draftQuery}
                        onChange={(e)=>changeQuery(e.target.value)}
                        onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing&&inputOwns()){event.preventDefault();if(draftRef.current!==searchText)rawGo('search.query.change',{query:draftRef.current});inputRef.current?.blur();KeyboardService.hide();}}}
                        placeholder={s.search_placeholder_default}
                        className="bg-transparent flex-1 min-w-0 text-sm outline-none placeholder-(--app-c-tw-placeholder-gray-400) text-(--app-c-tw-text-slate-800)"
                        autoFocus={!viewport.restoring}
                    />
                    {draftQuery ? (
                        <button type="button" aria-label={s.search_clear_query} data-keep-keyboard="true" onPointerDown={keepPointerStable} {...bindTap('search.query.change', { params: { query: '' },onTrigger:()=>{if(inputOwns()){draftRef.current='';setDraftQuery('');rawGo('search.query.change',{query:''});inputRef.current?.focus({preventScroll:true});KeyboardService.show();}} })}>
                            <IcClose size={dimens.icSizeChevron} className="text-(--app-c-tw-text-gray-400)" />
                        </button>
                    ) : null}
                </div>
                {!draftQuery && (
                    <div className="p-1">
                        <IcScan size={dimens.icSizeNav} className="text-(--app-c-tw-text-gray-500)" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div ref={viewport.main} data-keep-keyboard="true" onPointerDown={keepPointerStable} onClick={finishSelection} data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 min-h-0 overflow-y-auto">
                {!searchText ? (
                    /* Hot Search List */
                    <div className="px-4 py-2">
                        <div className="flex justify-between items-center mb-4 mt-2">
                            <h2 className="text-lg font-bold text-(--app-c-tw-text-slate-800)">{s.search_hot_list}</h2>
                            <div className="px-2 py-0.5 bg-(--app-c-tw-bg-gray-100) rounded-full text-xs text-(--app-c-tw-text-gray-500) flex items-center">
                                {s.search_more_rankings} <IcNavBack size={dimens.icSizeInlineArrow} className="rotate-180 ml-0.5" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-6">
	                            {hotSearchList.map((item, index) => (
	                                <div
	                                    key={item.id}
	                                    className="flex gap-4"
	                                    {...bindTap('search.hot.item', { params: { hotId: item.id, query: item.title } })}
	                                >
	                                    <div className={`text-lg font-bold w-4 text-center ${index < 3 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-400)'}`}>
	                                        {item.rank}
	                                    </div>
                                    <div className={`w-12 h-16 ${item.coverColor} rounded shadow-sm shrink-0`} />
                                    <div className="flex flex-col justify-center flex-1 min-w-0 gap-1">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">{item.title}</h3>
                                        {item.subtitle ? (
                                            <div className="text-sm text-(--app-c-tw-text-gray-400) line-clamp-1">{item.subtitle}</div>
                                        ) : (
                                            <div className="text-sm text-(--app-c-tw-text-gray-400)">{item.people}</div>
                                        )}
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-(--app-c-tw-text-gray-400)">{item.metric}</span>
                                            {item.badge && (
                                                <span className={`text-(--app-title-text-size-9) px-1 py-0.5 border rounded ${BOOK_BADGE_COLOR_MAP[item.badge] || 'text-(--app-c-tw-text-gray-400) border-app-border'}`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Search Results */
                    <div>
                        {/* Tabs */}
                        <div ref={viewport.tabs} data-scroll-container="searchTabs" data-scroll-direction="horizontal" className="wr-search-tabs flex items-center px-4 border-b border-(--app-c-tw-border-gray-100)">
                            {tabs.map(tab => (
                                <button type="button"
                                    key={tab.id}
                                    {...bindTap('search.tab.switch', { params: { tab: tab.id } })}
                                    aria-current={activeTab === tab.id ? 'page' : undefined}
                                    className={`shrink-0 whitespace-nowrap py-3 text-base font-medium cursor-pointer ${
                                        activeTab === tab.id
                                            ? 'text-(--app-c-tw-text-blue-500) border-b-2 border-(--app-c-tw-border-blue-500)'
                                            : 'text-(--app-c-tw-text-gray-500)'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="bg-(--app-c-tw-bg-gray-50) min-h-full p-3 flex flex-col gap-3">
                            {/* Authors Section */}
                            {showAuthors && searchResults.authors.length > 0 && (
                                <div className="bg-app-surface rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800)">{s.search_author_section}</h3>
                                        <div className="text-sm text-(--app-c-tw-text-gray-400) flex items-center">
                                            {s.search_more} <IcNavBack size={dimens.icSizeInlineArrow} className="rotate-180 ml-0.5" />
                                        </div>
                                    </div>
                                    {searchResults.authors.map(author => (
                                        <div key={author.name} className="flex items-center gap-3 mb-3 last:mb-0">
                                            <div className="w-10 h-10 rounded-full bg-(--app-c-tw-bg-gray-200) flex items-center justify-center text-(--app-c-tw-text-gray-500) text-sm font-bold">
                                                {author.name[0]}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="text-base font-bold text-(--app-c-tw-text-slate-800)">
                                                    <HighlightText text={author.name} highlight={searchText} />
                                                </div>
                                                <div className="text-sm text-(--app-c-tw-text-gray-400)">{author.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Books Section */}
                            {showBooks && searchResults.books.length > 0 && (
                                <div className="bg-app-surface rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800)">{s.search_ebook_section}</h3>
                                    </div>
                                    {searchResults.books.map(book => (
                                        <button type="button" data-reading-search-book-id={book.id}
                                            key={book.id}
                                            className="wr-search-result flex w-full gap-3 mb-4 last:mb-0 text-left"
                                            {...bindTap('book.detail.open', { params: { bookId: book.id } })}
                                        >
                                            <div className={`w-12 h-16 ${book.coverColor} rounded shadow-sm shrink-0 flex items-center justify-center text-(--app-item-text-size-8) p-1 text-center`}>
                                                {book.title}
                                            </div>
                                            <div className="flex flex-col justify-center flex-1 min-w-0 gap-1">
                                                <h4 className="text-base font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">
                                                    <HighlightText text={book.title} highlight={searchText} />
                                                </h4>
                                                <div className="text-sm text-(--app-c-tw-text-gray-400)">
                                                    <HighlightText text={book.author} highlight={searchText} />
                                                </div>
                                                <div className="text-xs text-(--app-c-tw-text-gray-400)">{typeof book.recommendedValue==='number'&&Number.isFinite(book.recommendedValue)&&book.recommendedValue>=0&&book.recommendedValue<=100?`${s.reading_recommendation_value} ${book.recommendedValue}%`:s.book_detail_unknown}</div>
                                            </div>

                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Audiobooks Section */}
                            {showAudiobooks && searchResults.audiobooks.length > 0 && (
                                <div className="bg-app-surface rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800)">{s.search_audiobook_section}</h3>
                                    </div>
                                    {searchResults.audiobooks.map((audio: any) => (
                                        <button type="button" data-reading-search-book-id={audio.id}
                                            key={audio.id}
                                            className="wr-search-result flex w-full gap-3 mb-4 last:mb-0 text-left"
                                            {...bindTap('book.detail.open', { params: { bookId: audio.id } })}
                                        >
                                            <div
                                                className="w-12 h-12 rounded-lg shadow-sm shrink-0 flex items-center justify-center text-(--app-item-text-size-8) p-1 text-center text-white font-bold"
                                                style={{ backgroundColor: audio.coverColor || '#999' }}
                                            >
                                                {audio.title.slice(0, 4)}
                                            </div>
                                            <div className="flex flex-col justify-center flex-1 min-w-0 gap-1">
                                                <h4 className="text-base font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">
                                                    <HighlightText text={audio.title} highlight={searchText} />
                                                </h4>
                                                <div className="text-sm text-(--app-c-tw-text-gray-400)">
                                                    {audio.author && <HighlightText text={audio.author} highlight={searchText} />}
                                                </div>
                                                <div className="text-xs text-(--app-c-tw-text-gray-400)">{s.search_audio_plays.replace('{0}',formatWechatReadingCount(audio.plays,locale))}{audio.rating?` · ${audio.rating}`:''}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'fulltext' && (
                                <section data-local-text-results className="bg-app-surface rounded-xl p-4">
                                    <p className="text-sm text-(--app-c-tw-text-gray-500)">{s.search_local_text_scope}</p>
                                    {textResults.loading && <p role="status" className="py-4">{s.search_local_text_loading}</p>}
                                    {textResults.failures > 0 && <p role="status" className="py-3 text-sm">{s.search_local_text_failed}</p>}
                                    {textResults.hits.map(({ book, excerpt }) => (
                                        <button type="button" key={book.id} className="block w-full py-4 text-left border-b border-(--app-c-tw-border-gray-100)" {...bindTap('book.detail.open', { params: { bookId: book.id } })}>
                                            <h3 className="font-bold">{book.title}</h3>
                                            <p className="mt-2 text-sm text-(--app-c-tw-text-gray-500)"><HighlightText text={excerpt} highlight={searchText.trim()} /></p>
                                        </button>
                                    ))}
                                </section>
                            )}
                            {activeTab === 'booklist' && <p className="text-sm text-(--app-c-tw-text-gray-500)">{s.search_local_lists_scope}</p>}
                            {showOwnedList && (
                                <button type="button" data-owned-list-result className="bg-app-surface rounded-xl p-4 text-left" {...bindTap('search.bookList.open')}>
                                    <h3 className="font-bold"><HighlightText text={ownedListTitle} highlight={searchText.trim()} /></h3>
                                    <p className="mt-2 text-sm text-(--app-c-tw-text-gray-500)">{s.search_local_list_count.replace('{0}', String(likedListBooks.length))}</p>
                                </button>
                            )}
                            {!hasResults && !(activeTab === 'fulltext' && textResults.loading) && (
                                <div className="text-center py-10 text-(--app-c-tw-text-gray-400) text-base">
                                    {s.search_no_result}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
