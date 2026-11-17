import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as FileSystem from '../../../os/FileSystemService';
import * as TimeService from '../../../os/TimeService';
import { AppLifecycle } from '../../../os/AppLifecycle';
import { useAppStrings } from '../../../os/useAppStrings';
import { IcNavBack, IcClose, IcSearch } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { useFileListRefresh } from '../hooks/useFileListRefresh';
import { useFileManagerListOwner, useFileManagerShareOwner } from '../hooks/useFileManagerShareOwner';
import { getFileIcon, getFileIconColor } from '../utils/fileUtils';
import { fileSearchNameParts, filterSearchFiles, normalizeSearchCategory, searchFileDestination, type FileSearchCategory } from '../utils/searchFiles';

export const SearchPage: React.FC = () => {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const query = search.get('q') || '';
  const [draft, setDraft] = useState(query);
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => {
    if (pendingQuery.current !== null) {
      if (query === pendingQuery.current) pendingQuery.current = null;
      return;
    }
    setDraft(query);
  }, [query]);
  const category = normalizeSearchCategory(search.get('category'));
  const { bindBack, bindTap, go } = useFileManagerGestures();
  const s = useAppStrings(strings, stringsEn);
  const ownsList = useFileManagerListOwner();
  const ownsPage = useFileManagerShareOwner();
  const [revision, setRevision] = useState(0);
  useEffect(() => AppLifecycle.subscribe('file_manager', event => {
    if (event === 'foreground') setRevision(value => value + 1);
  }), []);
  // Reconcile matching files while the page is visible, including an unfocused split pane.
  useFileListRefresh(
    () => filterSearchFiles(FileSystem.searchFiles('', { type: 'file' }), draft, category),
    () => setRevision(value => value + 1),
    ownsList,
  );
  // Re-read real files after returning from other apps, not a frozen fixture snapshot.
  const results = useMemo(() => {
    void revision;
    return filterSearchFiles(FileSystem.searchFiles('', { type: 'file' }), draft, category);
  }, [draft, category, revision]);
  const filters: { id: FileSearchCategory; label: string; disabled?: boolean }[] = [
    { id: 'all', label: s.search_all }, { id: 'images', label: s.category_images },
    { id: 'videos', label: s.category_videos }, { id: 'documents', label: s.category_documents },
    { id: 'audio', label: s.category_audio_alt }, { id: 'archives', label: s.search_archives },
    { id: 'packages', label: s.search_packages }, { id: 'apps', label: s.search_apps, disabled: true },
  ];
  return <div className="fm-search-page" data-status-bar-foreground="dark" data-navigation-bar-foreground="dark">
    <header className="fm-search-header">
      <button type="button" aria-label={s.search_back} {...bindBack()}><IcNavBack size={24} /></button>
      <div className="fm-search-field">
        <IcSearch size={20} />
        <input autoFocus aria-label={s.toolbar_search} placeholder={s.search_placeholder} value={draft}
          onChange={event => {
            const value = event.target.value;
            pendingQuery.current = value === query ? null : value;
            setDraft(value);
            go('search.query.update', { q: value });
          }} />
        {draft && <button type="button" aria-label={s.search_clear} {...bindTap('search.query.update', { params: { q: '' }, beforeTrigger: () => {
          pendingQuery.current = query ? '' : null; setDraft('');
        } })}><IcClose size={20} /></button>}
      </div>
    </header>
    <nav className="fm-search-filters" aria-label={s.search_filter_label}>
      {filters.map(filter => <button type="button" key={filter.id} disabled={filter.disabled}
        aria-current={category === filter.id ? 'page' : undefined}
        title={filter.disabled ? s.search_apps_unavailable : undefined}
        {...(filter.disabled ? {} : bindTap('search.filter.switch', { params: { category: filter.id, q: draft } }))}>{filter.label}</button>)}
    </nav>
    <main className="fm-search-results" data-scroll-container="main" data-scroll-direction="vertical">
      <p role="status">{s.search_result_count.replace('{{count}}', String(results.length))}</p>
      {!results.length && <div className="fm-search-empty">{s.search_no_results}</div>}
      {results.map(file => {
        const target = searchFileDestination(file), Icon = getFileIcon(file);
        const binding = target.kind === 'text' ? bindTap('file.text.open', { params: { path: target.path } })
          : target.kind === 'pdf' ? bindTap('file.pdf.open', { params: { path: target.path } })
          : bindTap('folder.open', { params: { path: target.path } });
        return <button className="fm-search-result" type="button" key={file.id} title={file.path} aria-label={`${file.name} · ${file.path}`} {...binding}
          onClick={event => {
            if (ownsPage() && FileSystem.getNode(file.path)?.id === file.id) binding.onClick(event);
          }}>
          <span className={`fm-search-icon ${getFileIconColor(file)}`}><Icon size={28} /></span>
          <span className="fm-search-copy"><strong>{fileSearchNameParts(file.name, draft).map((part, index) => part.match
            ? <mark className="fm-search-match" key={index}>{part.text}</mark> : <React.Fragment key={index}>{part.text}</React.Fragment>)}</strong>
            <small className="fm-search-path" data-file-search-path>{file.path}</small>
            <small className="fm-search-metadata">{TimeService.fromTimestamp(file.modifiedAt).toLocaleDateString()} · {FileSystem.formatFileSize(file.size)}{target.kind === 'folder' ? ` · ${s.search_open_folder}` : ''}</small></span>
        </button>;
      })}
    </main>
  </div>;
};
