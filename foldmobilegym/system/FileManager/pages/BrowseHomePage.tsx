/**
 * Browse Home Page
 * 
 * Categories + Storage overview with collapsible sticky header
 * Uses URL-based routing for modals and selection mode to support back gesture
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  IcNavForward, IcFolder, IcFileText, IcImage,
  IcVideo, IcMusic, IcFolderAdd, IcExpand, IcCheck,
  IcClose, IcList, IcSearch, IcFilter, IcMoreVert
} from '../res/icons';
import { FSNode } from '@/os/types';
import * as FileSystem from '@/os/FileSystemService';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { useFileLongPress } from '../hooks/useFileLongPress';
import { useFileListRefresh } from '../hooks/useFileListRefresh';
import { useFileManagerListOwner } from '../hooks/useFileManagerShareOwner';
import { TabBar } from '../components/TabBar';
import { Toast } from '@/os/components/Toast';
import { ActionMenu, InputDialog, FileDetailsDialog } from '../components/Dialog';
import { FileDeleteDialog } from '../components/FileDeleteDialog';
import { TransferSheet } from '../components/TransferSheet';
import { FileManagerReferenceHeader, FileManagerReferenceShell } from '../components/FileManagerReferenceLayout';
import { CollapsingToolbar, CollapsingLargeTitle, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '@/os/components/CollapsingToolbar';
import { IcShare, IcMove, IcDelete, IcMoreCircle } from '../res/icons';
import { AsyncImage } from '../components/AsyncImage';
import { getFileIcon, getFileIconColor, isPdfPreviewableFile, isTextPreviewableFile } from '../utils/fileUtils';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '@/os/TimeService';
import { transferNodesToDirectory, type TransferOperation } from '../utils/fileOperations';
import { useFileManagerStore } from '../state';
export const BrowseHomePage: React.FC = () => {
  const { go, back, bindTap } = useFileManagerGestures();
  const location = useLocation();
  const ownsList = useFileManagerListOwner();
  const s = useAppStrings(strings, stringsEn);
  const addFavorites = useFileManagerStore(state => state.addFavorites);
  const setPrivate = useFileManagerStore(state => state.setPrivate);

  // Parse URL state
  const searchParams = new URLSearchParams(location.search);
  const isSelecting = searchParams.get('mode') === 'select';
  const modal = searchParams.get('modal') as 'delete' | 'more' | 'details' | 'rename' | 'transfer' | null;
  const modalItemId = searchParams.get('itemId');
  const transferOperation: TransferOperation = searchParams.get('operation') === 'move' ? 'move' : 'copy';
  const transferDialog = searchParams.get('transferDialog');

  // Selection state (local state, like WechatReading)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isLongPress = useRef(false);

  // Clear selection and reset long press flag when exiting select mode
  useEffect(() => {
    if (!isSelecting) {
      setSelectedIds(new Set());
      isLongPress.current = false;
    }
  }, [isSelecting]);

  const toggleSelect = (itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAll = (allIds: string[]) => {
    setSelectedIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const enterSelectMode = (initialItemId?: string) => {
    if (isSelecting) return;
    isLongPress.current = true;
    if (initialItemId) setSelectedIds(new Set([initialItemId]));
    go('browse.select.enter', {});
  };

  const exitSelectMode = () => {
    isLongPress.current = false;
    back();
  };

  const openModal = (type: 'delete' | 'more' | 'details' | 'rename', itemId?: string) => {
    if (type === 'delete') go('browse.modal.delete.open', {});
    else if (type === 'more') go('browse.modal.more.open', {});
    else if (type === 'details') go('browse.modal.details.open', itemId ? { itemId } : {});
    else if (type === 'rename') go('browse.modal.rename.open', itemId ? { itemId } : {});
  };

  const closeModal = () => {
    back();
  };
  
  const [storageItems, setStorageItems] = useState<FSNode[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2000);
  };

  const readItems = useCallback(() => {
    const items = FileSystem.listDirectory('/sdcard')
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return items;
  }, []);

  const refreshItems = useCallback(() => {
    setStorageItems(readItems());
  }, [readItems]);
  
  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  useFileListRefresh(readItems, refreshItems, () => ownsList() && !isSelecting && !modal);
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const handleItemClick = (item: FSNode) => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    if (isSelecting) {
      toggleSelect(item.id);
      return;
    }
    if (item.type === 'directory') go('folder.open', { path: item.path });
    else if (isTextPreviewableFile(item)) go('file.text.open', { path: item.path });
    else if (isPdfPreviewableFile(item)) go('file.pdf.open', { path: item.path });
  };

  const bindItemPress = useFileLongPress<FSNode>(item => enterSelectMode(item.id), isLongPress, location.key);

  const toggleSelectAll = () => {
    if (selectedIds.size === storageItems.length) {
      clearSelection();
    } else {
      selectAll(storageItems.map(i => i.id));
    }
  };

  const isAllSelected = storageItems.length > 0 && selectedIds.size === storageItems.length;

  const getSelectedNodes = (): FSNode[] => storageItems.filter(i => selectedIds.has(i.id));

  const openTransferSheet = (operation: TransferOperation) => {
    if (selectedIds.size === 0) return;
    go('browse.modal.transfer.open', { operation }, { mode: modal === 'more' ? 'replace' : 'push' });
  };

  const openTransferCreateFolder = () => {
    go('browse.modal.transfer.newFolder.open');
  };

  // Get target item for modals
  const modalTargetItem = useMemo(() => {
    if (modalItemId) {
      return storageItems.find(i => i.id === modalItemId) || null;
    }
    // For single selection, use the first selected item
    if (selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      return storageItems.find(i => i.id === id) || null;
    }
    return null;
  }, [modalItemId, selectedIds, storageItems]);

  const handleRenameClick = () => {
    if (selectedIds.size !== 1) {
      showToast(s.select_single_item_required);
      return;
    }
    const id = Array.from(selectedIds)[0];
    go('browse.modal.rename.open.fromBase', { itemId: id }, { popSteps: 2 });
  };

  const doRename = async (newName: string) => {
    if (!modalTargetItem) return false;
    if (FileSystem.getNode(modalTargetItem.path)?.id !== modalTargetItem.id) return false;
    const parentPath = modalTargetItem.path.substring(0, modalTargetItem.path.lastIndexOf('/'));
    const result = await FileSystem.moveNode(modalTargetItem.path, `${parentPath}/${newName}`);
    if (!result) { showToast(s.toast_rename_failed); return false; }
    showToast(s.toast_rename_success);
    refreshItems();
    return true;
  };

  const handleTransferConfirm = async (destPath: string) => {
    const success = await transferNodesToDirectory(getSelectedNodes(), destPath, transferOperation);
    if (success) {
      showToast(transferOperation === 'copy' ? s.transfer_copy_success : s.transfer_move_success);
      closeModal();
      exitSelectMode();
      refreshItems();
    } else {
      showToast(transferOperation === 'copy' ? s.transfer_copy_failed : s.transfer_move_failed);
    }
  };

  const handleShowDetails = () => {
    if (selectedIds.size !== 1) {
      showToast(s.select_single_item_required);
      return;
    }
    const id = Array.from(selectedIds)[0];
    go('browse.modal.details.open.fromBase', { itemId: id }, { popSteps: 2 });
  };

  const selectionMoreOptions = [
    { label: s.menu_copy, onClick: () => openTransferSheet('copy') },
    { label: s.menu_set_private, onClick: () => { showToast(setPrivate(getSelectedNodes()) ? s.toast_private_added : s.toast_action_unavailable); closeModal(); } },
    { label: s.menu_favorite, onClick: () => { showToast(addFavorites(getSelectedNodes()) ? s.toast_added_to_favorites : s.toast_favorite_failed); closeModal(); } },
    { label: s.menu_rename, onClick: handleRenameClick },
    { label: s.menu_compress, onClick: () => { showToast(s.toast_action_unavailable); closeModal(); } },
    { label: s.menu_add_to_widget, onClick: () => { showToast(s.toast_action_unavailable); closeModal(); } },
    { label: s.menu_open_with_other_app, onClick: () => { showToast(s.toast_action_unavailable); closeModal(); } },
    { label: s.menu_details, onClick: handleShowDetails },
  ];

  const categories = [
    { id: 'documents', name: s.category_documents, icon: IcFileText, color: 'text-amber-500 bg-amber-100' },
    { id: 'images', name: s.category_images, icon: IcImage, color: 'text-blue-500 bg-blue-100' },
    { id: 'videos', name: s.category_videos, icon: IcVideo, color: 'text-purple-500 bg-purple-100' },
    { id: 'audio', name: s.category_audio, icon: IcMusic, color: 'text-red-500 bg-red-100' },
  ];

  const formatDate = (timestamp: number) => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <FileManagerReferenceShell section="browse" selecting={isSelecting} settingsBindings={bindTap('settings.open')}>
    <div className="h-full bg-app-surface flex flex-col relative overflow-hidden">
      <div inert={!!modal} style={{ display: 'contents' }}>
      {!isSelecting ? (
        <FileManagerReferenceHeader
          title={s.directory_my_files}
          searchBindings={bindTap('search.open')}
          count={storageItems.length}
        />
      ) : null}
      <div className="fm-compact-toolbar">
      <CollapsingToolbar
        title={isSelecting ? (selectedIds.size > 0 ? `${s.selected_prefix}${selectedIds.size}${s.item_count_suffix}` : s.select_items_prompt) : s.tab_browse}
        scrollTop={scrollTop}
        alwaysShowSmallTitle={false}
        bgClass="bg-app-surface"
        leftContent={isSelecting ? (
          <button onClick={exitSelectMode} className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60">
            <IcClose size={28} className="text-app-text" />
          </button>
        ) : undefined}
        rightContent={isSelecting ? (
          <button onClick={toggleSelectAll} className="w-10 h-10 flex items-center justify-center active:opacity-60">
            <IcList size={28} className={isAllSelected ? 'text-blue-500' : 'text-gray-400'} />
          </button>
        ) : (
          <>
            <button type="button" className="w-10 h-10 flex items-center justify-center" aria-label={s.toolbar_search} {...bindTap('search.open')}><IcSearch size={26} /></button>
            <ToolbarIconButton icon={IcFilter} label={s.toolbar_filter} />
            <ToolbarIconButton icon={IcMoreVert} label={s.toolbar_more} />
          </>
        )}
      />
      </div>

      <div 
        className="fm-reference-main-scroll flex-1 overflow-y-auto no-scrollbar"
        style={{ paddingBottom: isSelecting ? 'var(--app-selection-action-bar-scroll-padding)' : undefined }}
        onScroll={handleScroll}
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="fm-compact-only" style={{ height: TOOLBAR_SPACER_HEIGHT }} />
        <div className="fm-compact-only">
        <CollapsingLargeTitle
          title={isSelecting ? (selectedIds.size > 0 ? `${s.selected_prefix}${selectedIds.size}${s.item_count_suffix}` : s.select_items_prompt) : s.tab_browse}
          scrollTop={scrollTop}
        />
        </div>

        {/* Categories Section */}
        <div className="fm-compact-only px-6 mb-4 mt-1">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[15px] font-medium text-gray-400">{s.section_file_type}</span>
            <button className="text-[14px] text-gray-400 flex items-center gap-0.5">
              {s.action_more} <IcExpand size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => go('category.open', { category: cat.id })}
                className="flex items-center gap-4 p-4 bg-gray-50/80 rounded-[20px] active:scale-[0.98] transition-transform"
              >
                <div className={`w-11 h-11 rounded-xl ${cat.color} flex items-center justify-center shrink-0`}>
                  <cat.icon size={22} strokeWidth={2.5} />
                </div>
                <span className="text-[17px] font-semibold text-app-text">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Storage Section */}
        <div className="px-6 relative">
          <div className="fm-compact-only sticky top-(--app-section-title-sticky-top) z-20 bg-app-surface pt-2 pb-4 flex justify-between items-center -mx-6 px-6">
            <span className="text-[15px] font-medium text-gray-400">{s.section_internal_storage}</span>
            <button className="text-gray-400 active:opacity-60">
              <IcFolderAdd size={20} strokeWidth={1.5} />
            </button>
          </div>
          
          <div className="fm-reference-file-list space-y-0.5">
            {storageItems.map(item => {
              const Icon = getFileIcon(item);
              const iconColor = getFileIconColor(item);
              const isImage = item.mimeType?.startsWith('image/');
              const isOpenable = item.type === 'directory' || isTextPreviewableFile(item) || isPdfPreviewableFile(item);
              const itemMeta = item.type === 'directory'
                ? `${FileSystem.listDirectory(item.path).length}${s.item_count_suffix}`
                : FileSystem.formatFileSize(item.size);
              const aliasMap: Record<string, string> = {
                'Android': s.alias_android,
                'backups': s.alias_backups,
                'BaiduNetdisk': s.alias_baidu_netdisk,
                'DCIM': s.alias_dcim
              };
              const alias = aliasMap[item.name];
              const isSelected = selectedIds.has(item.id);
              const triggerId = item.type === 'directory'
                ? 'folder.open'
                : isTextPreviewableFile(item)
                  ? 'file.text.open'
                  : isPdfPreviewableFile(item)
                    ? 'file.pdf.open'
                    : undefined;

              return (
                <button
                  key={item.id}
                  data-trigger={!isSelecting ? triggerId : undefined}
                  data-trigger-type={!isSelecting && triggerId ? 'tap' : undefined}
                  data-trigger-params={!isSelecting && triggerId ? JSON.stringify({ path: item.path }) : undefined}
                  onClick={() => handleItemClick(item)}
                  onContextMenu={(e) => e.preventDefault()}
                  {...bindItemPress(item)}
                  data-file-item-id={item.id}
                  data-selected={isSelected}
                  className={`fm-reference-file-row flex items-center gap-4 w-full py-3 px-2 active:bg-gray-50 transition-colors rounded-xl ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="fm-reference-file-icon w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center shrink-0">
                    {isImage ? (
                      <AsyncImage path={item.path} nodeId={item.id} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Icon size={32} className={iconColor} strokeWidth={1.5} {...(item.type === 'directory' ? { fill: 'currentColor' } : {})} />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-[17px] font-semibold text-app-text flex items-center gap-2">
                      <span className="truncate">{item.name}</span>
                      {alias && (
                        <>
                          <span className="text-gray-300 font-normal">|</span>
                          <span className="text-gray-400 font-normal truncate">{alias}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-gray-400 font-normal mt-0.5">
                      <span>{formatDate(item.modifiedAt)}</span>
                      <span>|</span>
                      <span>{itemMeta}</span>
                    </div>
                  </div>
                  
                  {isSelecting ? (
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-app-border'
                    }`}>
                      {isSelected && <IcCheck size={16} className="text-white" strokeWidth={3} />}
                    </div>
                  ) : (
                    isOpenable && <IcNavForward size={20} className="text-gray-300 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {!isSelecting && <div style={{ height: 'var(--app-main-tab-bar-height)' }} />}
      </div>
      
      {/* Bottom Action Bar */}
      {isSelecting && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-app-surface flex items-center justify-around pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] z-40 animate-in slide-in-from-bottom-10 duration-200"
          style={{ minHeight: 'var(--app-selection-action-bar-height)' }}
        >
          <button className="flex flex-col items-center gap-1.5 px-4 active:opacity-60">
            <div className="w-6 h-6 flex items-center justify-center">
              <IcShare />
            </div>
            <span className="text-[12px] text-app-text">{s.action_send}</span>
          </button>
          <button onClick={() => openTransferSheet('move')} className="flex flex-col items-center gap-1.5 px-4 active:opacity-60">
            <div className="w-6 h-6 flex items-center justify-center">
              <IcMove />
            </div>
            <span className="text-[12px] text-app-text">{s.action_move}</span>
          </button>
          <button onClick={() => openModal('delete')} className="flex flex-col items-center gap-1.5 px-4 active:opacity-60">
            <div className="w-6 h-6 flex items-center justify-center">
              <IcDelete />
            </div>
            <span className="text-[12px] text-app-text">{s.action_delete}</span>
          </button>
          <button onClick={() => openModal('more')} className="flex flex-col items-center gap-1.5 px-4 active:opacity-60">
            <div className="w-6 h-6 flex items-center justify-center">
              <IcMoreCircle />
            </div>
            <span className="text-[12px] text-app-text">{s.action_more}</span>
          </button>
        </div>
      )}

      </div>
      <FileDeleteDialog
        open={modal === 'delete'}
        onClose={closeModal}
        nodes={getSelectedNodes()}
        onResult={ids => { setSelectedIds(previous => new Set([...previous].filter(id => !ids.includes(id)))); refreshItems(); }}
        onSuccess={() => { clearSelection(); back(2); }}
        showToast={showToast}
      />
      
      <ActionMenu 
        open={modal === 'more'} 
        onClose={closeModal} 
        options={selectionMoreOptions} 
      />

      <InputDialog
        open={modal === 'rename'}
        onClose={closeModal}
        title={s.rename_title}
        defaultValue={modalTargetItem?.name}
        onConfirm={doRename}
      />

      <FileDetailsDialog 
        open={modal === 'details'} 
        onClose={closeModal} 
        file={modalTargetItem} 
      />

      <TransferSheet
        open={modal === 'transfer'}
        operation={transferOperation}
        selectedNodes={getSelectedNodes()}
        onClose={closeModal}
        onConfirm={handleTransferConfirm}
        isCreateFolderOpen={transferDialog === 'newFolder'}
        onOpenCreateFolder={openTransferCreateFolder}
        onCloseCreateFolder={back}
        onCreatedFolder={refreshItems}
      />
      
      <Toast message={toast.message} visible={toast.visible} />
      
      {!isSelecting && <div className="fm-compact-only" inert={!!modal}><TabBar /></div>}
    </div>
    </FileManagerReferenceShell>
  );
};

export default BrowseHomePage;
