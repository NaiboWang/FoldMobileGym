import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as MediaService from '../../../os/MediaService';
import { initFileSystem } from '../../../os/FileSystemService';
import ContentResolver from '../../../os/ContentResolver';
import KeyboardService from '../../../os/keyboard/KeyboardService';
import type { MediaItem } from '../../../os/types';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcClose, IcNavBack, IcSearch, IcVideo } from '../res/icons';
import { useGalleryGestures } from '../hooks/useGalleryGestures';
import { searchMedia } from '../mediaSearch';
import { useGalleryPageOwner } from '../useGalleryPageOwner';

export function GallerySearchPage({ renderThumbnail, scrollMemory }: {
  renderThumbnail: (item: MediaItem) => React.ReactNode;
  scrollMemory: Map<string, number>;
}) {
  const s = useAppStrings(strings, stringsEn);
  const { go, bindTap, bindBack } = useGalleryGestures();
  const location = useLocation(), ownsPage = useGalleryPageOwner();
  const q = new URLSearchParams(location.search).get('q') || '';
  const [draft, setDraft] = useState(q);
  const draftRef = useRef(q), ownQuery = useRef<string | null>(null), composing = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<MediaItem[]>(() => MediaService.getMediaItems({ type:'all' }));
  useEffect(() => {
    let active = true;
    const reload = () => { if (active) setItems(MediaService.getMediaItems({type:'all'})); };
    const off = ContentResolver.registerContentObserver('content://media',reload);
    void initFileSystem().then(reload);
    return () => { active=false; off(); };
  }, [location.key]);
  useLayoutEffect(() => {
    // Do not overwrite characters typed after our own submit but before its URL
    // commit; external query navigation, however, must synchronise the field.
    if (ownQuery.current !== q) { draftRef.current = q; setDraft(q); composing.current = false; }
    ownQuery.current = null;
  }, [q, location.key]);
  const results = useMemo(() => searchMedia(items, q), [items,q]);
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = scrollMemory.get(q) ?? 0; }, [q, results.length, scrollMemory]);
  const submit = (value: string) => {
    if (!ownsPage() || composing.current) return;
    ownQuery.current = value;
    go('gallery.search.results', { q:value });
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
    KeyboardService.hide();
  };
  return <section className="gallery-search-root pt-10" data-status-bar-foreground="dark" data-gallery-search="true">
    <header className="gallery-search-header">
      <button type="button" {...bindBack()} aria-label={s.viewer_back}><IcNavBack size={26} /></button>
      <form onSubmit={event => { event.preventDefault(); submit(draftRef.current); }}>
        <input type="search" value={draft} aria-label={s.search_placeholder} placeholder={s.search_placeholder}
          data-action="gallery.search.query.input" data-action-type="input" data-action-params={JSON.stringify({ value:draft })}
          onCompositionStart={() => { if (ownsPage()) composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onChange={event => { if (!ownsPage()) return; draftRef.current = event.currentTarget.value; setDraft(event.currentTarget.value); }} />
        <button type="button" {...bindTap('gallery.search.results', { params:{q:draft}, onTrigger:() => submit(draftRef.current) })}>{s.search_label}</button>
        <button type="button" aria-label={s.search_clear} {...bindTap('gallery.search.results', { params:{q:''}, onTrigger:() => {
          if (!ownsPage()) return;
          composing.current = false; draftRef.current = ''; setDraft(''); submit('');
        } })}><IcClose size={20} /></button>
      </form>
    </header>
    <div ref={scroller} className="gallery-search-results" data-scroll-container="main" data-scroll-direction="vertical"
      onScroll={event => scrollMemory.set(q, event.currentTarget.scrollTop)}>
      {!q.trim() ? <p className="gallery-search-notice">{s.search_hint}</p> : <>
        <p className="gallery-search-notice" role="status">{s.search_count.replace('{count}',String(results.length))}</p>
        {!results.length ? <div className="gallery-search-empty"><IcSearch size={32} /><p>{s.search_empty}</p></div> :
          <div className="gallery-search-grid">{results.map(item => <button type="button" key={item.path}
            data-gallery-source-id={item.path} aria-label={item.name}
            {...bindTap('gallery.search.photo.open', { params:{ path:encodeURIComponent(item.path), q }, onTrigger:() => {
              if (!ownsPage() || !searchMedia(MediaService.getMediaItems({type:'all'}),q).some(media => media.path === item.path)) return;
              scrollMemory.set(q,scroller.current?.scrollTop ?? 0);
              go('gallery.search.photo.open', { path:encodeURIComponent(item.path), q });
            } })}>
            <span className="gallery-search-thumbnail">{renderThumbnail(item)}{item.type === 'video' && <span className="gallery-search-video"><IcVideo size={14} />{s.search_video}</span>}</span>
            <span className="gallery-search-filename">{item.name}</span>
          </button>)}</div>}
      </>}
    </div>
  </section>;
}
