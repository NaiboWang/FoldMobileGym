import React from 'react';
import * as FileSystem from '@/os/FileSystemService';
import { useAppStrings } from '@/os/useAppStrings';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import {
  IcArchive,
  IcBookmark,
  IcClock,
  IcFileText,
  IcFolder,
  IcGrid,
  IcImage,
  IcLock,
  IcMusic,
  IcNavBack,
  IcNavForward,
  IcSearch,
  IcSettings,
  IcStar,
  IcVideo,
} from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

type Section = 'browse' | 'recent' | 'favorites' | 'private' | 'category';

export const FileManagerReferenceShell: React.FC<{
  section: Section;
  currentPath?: string;
  category?: string;
  selecting?: boolean;
  settingsBindings: React.ButtonHTMLAttributes<HTMLButtonElement>;
  children: React.ReactNode;
}> = ({ section, currentPath, category, selecting = false, settingsBindings, children }) => (
  <div className="fm-reference-shell h-full bg-app-surface relative overflow-hidden">
    <FileManagerDirectoryRail section={section} currentPath={currentPath} category={category} settingsBindings={settingsBindings} />
    <div className={`fm-reference-pane min-w-0 min-h-0 relative overflow-hidden ${selecting ? 'fm-selecting' : ''}`}>
      {children}
    </div>
  </div>
);

const FileManagerDirectoryRail: React.FC<{
  section: Section;
  currentPath?: string;
  category?: string;
  settingsBindings: React.ButtonHTMLAttributes<HTMLButtonElement>;
}> = ({ section, currentPath, category, settingsBindings }) => {
  const { go } = useFileManagerGestures();
  const s = useAppStrings(strings, stringsEn);
  const folderPriority = ['Documents', 'Download', 'Pictures', 'DCIM'];
  const allFolders = FileSystem.listDirectory('/sdcard').filter(item => item.type === 'directory');
  const folders = folderPriority
    .map(name => allFolders.find(item => item.name === name))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const openBrowse = () => {
    if (section !== 'browse' || currentPath) go('rail.browse.open');
  };
  const openRecent = () => {
    if (section !== 'recent') go('rail.recent.open');
  };
  const openFavorites = () => {
    if (section !== 'favorites') go('rail.favorites.open');
  };
  const openPrivate = () => {
    if (section !== 'private') go('rail.private.open');
  };
  const openFolder = (path: string) => {
    if (currentPath !== path) go('rail.folder.open', { path });
  };
  const openCategory = (nextCategory: string) => {
    if (section !== 'category' || category !== nextCategory) go('rail.category.open', { category: nextCategory });
  };

  const categories = [
    { id: 'images', label: s.category_images, icon: IcImage, tone: 'blue' },
    { id: 'videos', label: s.category_videos, icon: IcVideo, tone: 'orange' },
    { id: 'documents', label: s.category_documents, icon: IcFileText, tone: 'green' },
    { id: 'audio', label: s.category_audio_alt, icon: IcMusic, tone: 'purple' },
  ] as const;

  return (
    <aside className="fm-reference-rail" aria-label={s.directory_label}>
      <div className="fm-reference-rail-top">
        <span className="fm-reference-menu-lines" aria-hidden="true"><i /><i /><i /></span>
        <button type="button" className="fm-reference-settings" {...settingsBindings} aria-label={s.directory_settings}>
          <IcSettings size={22} />
        </button>
      </div>
      <h1>{s.directory_title}</h1>
      <nav className="fm-reference-rail-scroll" data-scroll-container="directory" data-scroll-direction="vertical">
        <button
          type="button"
          className={`fm-reference-rail-row ${section === 'recent' ? 'is-active' : ''}`}
          onClick={openRecent}
          data-trigger="rail.recent.open"
          data-trigger-type="tap"
        >
          <IcClock size={20} /><span>{s.tab_recent}</span>
        </button>
        <button
          type="button"
          className={`fm-reference-rail-row ${section === 'favorites' ? 'is-active' : ''}`}
          onClick={openFavorites}
          data-trigger="rail.favorites.open"
          data-trigger-type="tap"
        >
          <IcStar size={20} /><span>{s.directory_favorites}</span>
        </button>
        <button
          type="button"
          className={`fm-reference-rail-row ${section === 'private' ? 'is-active' : ''}`}
          onClick={openPrivate}
          data-trigger="rail.private.open"
          data-trigger-type="tap"
        >
          <IcLock size={20} /><span>{s.directory_private}</span>
        </button>
        <button
          type="button"
          className={`fm-reference-rail-row ${section === 'browse' && !currentPath ? 'is-active' : ''}`}
          onClick={openBrowse}
          data-trigger="rail.browse.open"
          data-trigger-type="tap"
        >
          <IcFileText size={20} /><span>{s.directory_my_files}</span><IcNavForward className="fm-reference-row-chevron" size={15} />
        </button>
        <div className="fm-reference-tree">
          {folders.map(folder => (
            <button
              type="button"
              key={folder.id}
              className={`fm-reference-rail-row fm-reference-tree-row ${currentPath === folder.path ? 'is-active' : ''}`}
              onClick={() => openFolder(folder.path)}
              data-trigger="rail.folder.open"
              data-trigger-type="tap"
              data-trigger-params={JSON.stringify({ path: folder.path })}
            >
              <IcFolder size={19} /><span>{folder.name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="fm-reference-rail-row" disabled>
          <IcBookmark size={20} /><span>{s.directory_tags}</span><IcNavForward className="fm-reference-row-chevron" size={15} />
        </button>

        <h2>{s.directory_quick_access}</h2>
        {categories.map(item => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={`fm-reference-rail-row ${section === 'category' && category === item.id ? 'is-active' : ''}`}
              onClick={() => openCategory(item.id)}
              data-trigger="rail.category.open"
              data-trigger-type="tap"
              data-trigger-params={JSON.stringify({ category: item.id })}
            >
              <span className={`fm-reference-category-icon is-${item.tone}`}><Icon size={15} /></span>
              <span>{item.label}</span>
            </button>
          );
        })}
        <button type="button" className="fm-reference-rail-row" disabled>
          <span className="fm-reference-category-icon is-teal"><ArchiveIcon /></span><span>{s.directory_apps}</span>
        </button>
        <button type="button" className="fm-reference-rail-row" disabled>
          <span className="fm-reference-category-icon is-red"><IcArchive size={15} /></span><span>{s.directory_archives}</span>
        </button>
      </nav>
    </aside>
  );
};

const ArchiveIcon = () => <IcGrid size={15} />;

export const FileManagerReferenceHeader: React.FC<{
  title: string;
  context?: React.ReactNode;
  searchBindings: React.ButtonHTMLAttributes<HTMLButtonElement>;
  showBack?: boolean;
  onBack?: () => void;
  onAdd?: () => void;
  count: number;
}> = ({ title, context, searchBindings, showBack = false, onBack, onAdd, count }) => {
  const s = useAppStrings(strings, stringsEn);
  const [isUnfolded, setIsUnfolded] = React.useState(
    () => window.__FOLDAGENT__?.getState().posture === 'unfolded',
  );
  React.useEffect(() => {
    const syncPosture = () => setIsUnfolded(window.__FOLDAGENT__?.getState().posture === 'unfolded');
    window.addEventListener('foldagent:posturechange', syncPosture);
    return () => window.removeEventListener('foldagent:posturechange', syncPosture);
  }, []);
  return (
    <div className="fm-reference-pane-chrome" aria-hidden={!isUnfolded}>
      <header className="fm-reference-pane-header">
        <div className="fm-reference-pane-title">
          {showBack ? <button type="button" onClick={onBack} aria-label={isUnfolded ? s.search_back : undefined}><IcNavBack size={26} /></button> : null}
          <strong>{title}</strong>
        </div>
        <div className="fm-reference-pane-actions">
          <button type="button" {...searchBindings} aria-label={isUnfolded ? s.toolbar_search : undefined}><IcSearch size={25} /></button>
          <button type="button" onClick={onAdd} disabled={!onAdd} aria-label={isUnfolded ? s.toolbar_new_folder : undefined}><span className="fm-reference-plus">+</span></button>
          <button type="button" disabled aria-label={isUnfolded ? s.toolbar_filter : undefined}><IcFilterReference /></button>
        </div>
      </header>
      <div className="fm-reference-pane-context">{context ?? title}</div>
      <div className="fm-reference-list-summary">
        <span>{s.directory_count_prefix} {count} {s.item_count_suffix}</span>
        <span className="fm-reference-sort">{s.directory_sort_time}<b>↓</b><IcGrid size={18} /></span>
      </div>
    </div>
  );
};

const IcFilterReference = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
  </svg>
);
