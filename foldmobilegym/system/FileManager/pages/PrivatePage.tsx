import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { FileManagerReferenceHeader, FileManagerReferenceShell } from '../components/FileManagerReferenceLayout';
import { useFileManagerStore } from '../state';
import * as FileSystem from '@/os/FileSystemService';
import type { FSNode } from '@/os/types';
import { getFileIcon, getFileIconColor, isPdfPreviewableFile, isTextPreviewableFile } from '../utils/fileUtils';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { IcLock, IcNavBack, IcNavForward, IcSearch } from '../res/icons';
import { useFileManagerShareOwner } from '../hooks/useFileManagerShareOwner';
import { CollapsingToolbar, TOOLBAR_SPACER_HEIGHT } from '@/os/components/CollapsingToolbar';

export const PrivatePage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { go, bindTap } = useFileManagerGestures();
  const ownsList = useFileManagerShareOwner();
  const privateIds = useFileManagerStore(state => state.privateIds);

  const [, setFilesystemReady] = useState(false);
  useEffect(() => {
    let active = true;
    void FileSystem.initFileSystem().then(() => {
      if (active) setFilesystemReady(true);
    });
    return () => { active = false; };
  }, []);
  useSyncExternalStore(
    FileSystem.subscribeDestructiveOperationCounts,
    () => { const counts = FileSystem.getDestructiveOperationCounts(); return `${counts.deleted}:${counts.moved}`; },
  );
  const removePrivate = useFileManagerStore(state => state.removePrivate);
  const items = privateIds
    .map(id => ({ id, node: FileSystem.getNodeById(id) }))
    .filter((entry): entry is { id: string; node: FSNode } => Boolean(entry.node));

  const openItem = (item: FSNode) => {
    if (!ownsList() || FileSystem.getNode(item.path)?.id !== item.id) return;
    if (item.type === 'directory') go('folder.open', { path: item.path });
    else if (isTextPreviewableFile(item)) go('file.text.open', { path: item.path });
    else if (isPdfPreviewableFile(item)) go('file.pdf.open', { path: item.path });
    else if (item.mimeType?.startsWith('image/')) {
      window.__OS__?.startActivity?.({ action: 'ACTION_VIEW', type: item.mimeType, data: { stream: item.path } });
    }
  };

  return (
    <FileManagerReferenceShell section="private" settingsBindings={bindTap('settings.open')}>
      <div className="h-full bg-app-surface flex flex-col">
        <FileManagerReferenceHeader title={s.directory_private} searchBindings={bindTap('search.open')} count={items.length} />
        <div className="fm-compact-toolbar">
          <CollapsingToolbar
            title={s.directory_private}
            alwaysShowSmallTitle
            bgClass="bg-app-surface"
            leftContent={(
              <button type="button" className="w-10 h-10 flex items-center justify-center -ml-2" aria-label={s.search_back} {...bindTap('rail.browse.open')}>
                <IcNavBack size={28} />
              </button>
            )}
            rightContent={(
              <button type="button" className="w-10 h-10 flex items-center justify-center" aria-label={s.toolbar_search} {...bindTap('search.open')}>
                <IcSearch size={26} />
              </button>
            )}
          />
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
          <div className="fm-compact-only" style={{ height: TOOLBAR_SPACER_HEIGHT }} />
          {items.length === 0 ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-gray-400 gap-3">
              <IcLock size={48} />
              <span>{s.private_empty}</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map(({ id, node: item }) => {
                const Icon = getFileIcon(item);
                return (
                  <div key={item.id} data-file-collection-row={item.id} className="flex items-center gap-3 px-5 py-4">
                    <button type="button" data-file-collection-open onClick={() => openItem(item)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Icon size={23} className={getFileIconColor(item)} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-app-text">{item.name}</span>
                        <span className="block truncate text-[12px] text-gray-500">{item.path}</span>
                      </span>
                      <IcNavForward size={18} className="text-gray-400 shrink-0" />
                    </button>
                    <button type="button" data-file-collection-remove aria-label={s.private_remove} onClick={() => { if (ownsList() && useFileManagerStore.getState().privateIds.includes(id)) removePrivate(id); }} className="p-2 text-amber-500">
                      <IcLock size={20} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </FileManagerReferenceShell>
  );
};

export default PrivatePage;
