/**
 * Recent Files Page
 * 
 * Shows recent files grouped by date with 4-column grid layout and collapsible header
 * Uses URL-based routing for modals and selection mode to support back gesture
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { IcCollapse, IcExpand, IcCheck, IcClose, IcList } from '../res/icons';
import { dimens } from '../res/dimens';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { FSNode } from '@/os/types';
import * as FileSystem from '@/os/FileSystemService';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { useFileLongPress } from '../hooks/useFileLongPress';
import { useFileListRefresh } from '../hooks/useFileListRefresh';
import { AsyncImage } from '../components/AsyncImage';
import { getFileIcon, getFileIconColor } from '../utils/fileUtils';
import { TabBar } from '../components/TabBar';
import { Toast } from '@/os/components/Toast';
import { ActionMenu, FileDetailsDialog, InputDialog } from '../components/Dialog';
import { FileDeleteDialog } from '../components/FileDeleteDialog';
import { TransferSheet } from '../components/TransferSheet';
import { FileManagerReferenceHeader, FileManagerReferenceShell } from '../components/FileManagerReferenceLayout';
import { CollapsingToolbar, CollapsingLargeTitle, TOOLBAR_SPACER_HEIGHT } from '@/os/components/CollapsingToolbar';
import { IcShare, IcMove, IcDelete, IcMoreCircle } from '../res/icons';
import * as TimeService from '@/os/TimeService';
import { transferNodesToDirectory, shareNodesAsImages, captureFileManagerShareSources, type FileManagerShareSources, type TransferOperation } from '../utils/fileOperations';
import { useFileManagerShareOwner, useFileManagerShareSelection, useFileManagerListOwner } from '../hooks/useFileManagerShareOwner';
import { useFileManagerStore } from '../state';

export const RecentPage: React.FC = () => {
  const { go, back, bindTap } = useFileManagerGestures();
  const location = useLocation();
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

  // Selection state (local state)
  const { selectedIds, setSelectedIds, liveSelection } = useFileManagerShareSelection();
  const ownsPage = useFileManagerShareOwner();
  const ownsList = useFileManagerListOwner();

  const isLongPress = useRef(false);

  // Clear selection and reset long press flag when exiting select mode
  useEffect(() => {
    if (!isSelecting) {
      setSelectedIds(new Set());
      isLongPress.current = false;
    }
  }, [isSelecting, setSelectedIds]);

  const toggleSelect = (itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAll = (allIds: string[]) => setSelectedIds(new Set(allIds));
  const clearSelection = () => setSelectedIds(new Set());

  const enterSelectMode = (initialItemId?: string) => {
    if (isSelecting) return;
    isLongPress.current = true;
    if (initialItemId) setSelectedIds(new Set([initialItemId]));
    go('recent.select.enter', {});
  };

  const exitSelectMode = () => {
    isLongPress.current = false;
    back();
  };

  const openModal = (type: 'delete' | 'more' | 'details' | 'rename', itemId?: string) => {
    if (type === 'delete') go('recent.modal.delete.open', {});
    else if (type === 'more') go('recent.modal.more.open', {});
    else if (type === 'details') go('recent.modal.details.open', itemId ? { itemId } : {});
    else if (type === 'rename') go('recent.modal.rename.open', itemId ? { itemId } : {});
  };

  const closeModal = () => back();

  const [items, setItems] = useState<FSNode[]>([]);
  const [shareSources, setShareSources] = useState<FileManagerShareSources>(() => new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2000);
  };

  const readItems = useCallback(() => {
    const mediaFiles = FileSystem.getMediaFiles();
    const downloadFiles = FileSystem.getFilesByPath('/sdcard/Download');
    const allFiles = Array.from(new Set([...mediaFiles, ...downloadFiles]))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
    return allFiles;
  }, []);

  const refreshItems = useCallback(() => {
    const files = readItems();
    setShareSources(captureFileManagerShareSources(files));
    setItems(files);
  }, [readItems]);
  
  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  useFileListRefresh(readItems, refreshItems, () => ownsList() && !isSelecting && !modal);
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const toggleGroup = (date: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(date)) newCollapsed.delete(date);
    else newCollapsed.add(date);
    setCollapsedGroups(newCollapsed);
  };

  const groupedItems = useMemo(() => {
    const groups = new Map<string, FSNode[]>();
    const now = TimeService.getDate();
    const today = TimeService.fromLocalParts(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    items.forEach(item => {
      const itemDate = TimeService.fromTimestamp(item.modifiedAt);
      const itemDayStart = TimeService.fromLocalParts(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();
      const diffDays = Math.floor((today - itemDayStart) / oneDay);
      let dateKey = '';
      if (diffDays === 0) dateKey = s.date_today;
      else if (diffDays === 1) dateKey = s.date_yesterday;
      else if (diffDays > 1 && diffDays < 7) dateKey = `${diffDays}${s.date_days_ago_suffix}`;
      else dateKey = `${itemDate.getFullYear()}${s.date_year_suffix}${itemDate.getMonth() + 1}${s.date_month_suffix}${itemDate.getDate()}${s.date_day_suffix}`;
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(item);
    });
    return Array.from(groups.entries());
  }, [
    items,
    s.date_day_suffix,
    s.date_days_ago_suffix,
    s.date_month_suffix,
    s.date_today,
    s.date_year_suffix,
    s.date_yesterday,
  ]);

  const getSourceLabel = (path: string) => {
    if (path.toLowerCase().includes('screenshot')) return s.source_screenshot;
    if (path.toLowerCase().includes('camera')) return s.source_camera;
    if (path.toLowerCase().includes('download')) return s.source_download;
    if (path.toLowerCase().includes('wechat')) return s.source_wechat;
    return path.split('/').slice(-2, -1)[0] || s.source_internal_storage;
  };

  const truncateFileName = (name: string, maxLength: number = 12) => {
    if (name.length <= maxLength) return name;
    const extensionIndex = name.lastIndexOf('.');
    if (extensionIndex === -1 || extensionIndex === 0) return name.substring(0, maxLength - 3) + '...';
    const ext = name.substring(extensionIndex);
    const baseName = name.substring(0, extensionIndex);
    const fixedSuffixLength = 3 + 1 + ext.length;
    const availableForStart = maxLength - fixedSuffixLength;
    if (availableForStart <= 0) return name.substring(0, Math.max(0, maxLength - 3)) + '...';
    return baseName.substring(0, availableForStart) + '...' + baseName.slice(-1) + ext;
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
    if (item.mimeType?.startsWith('image/')) {
      window.__OS__?.startActivity?.({
        action: 'ACTION_VIEW',
        type: item.mimeType,
        data: { stream: item.path },
      });
    }
  };

  const bindItemPress = useFileLongPress<FSNode>(item => enterSelectMode(item.id), isLongPress, location.key);

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      clearSelection();
    } else {
      selectAll(items.map(i => i.id));
    }
  };

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const getSelectedNodes = (): FSNode[] => items.filter(i => selectedIds.has(i.id));

  const openTransferSheet = (operation: TransferOperation) => {
    if (selectedIds.size === 0) return;
    go('recent.modal.transfer.open', { operation }, { mode: modal === 'more' ? 'replace' : 'push' });
  };

  const openTransferCreateFolder = () => {
    go('recent.modal.transfer.newFolder.open');
  };

  // Get target item for modals
  const modalTargetItem = useMemo(() => {
    if (modalItemId) {
      return items.find(i => i.id === modalItemId) || null;
    }
    if (selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      return items.find(i => i.id === id) || null;
    }
    return null;
  }, [modalItemId, selectedIds, items]);

  const handleShowDetails = () => {
    if (selectedIds.size !== 1) {
      showToast(s.select_single_item_required);
      return;
    }
    const id = Array.from(selectedIds)[0];
    go('recent.modal.details.open.fromBase', { itemId: id }, { popSteps: 2 });
  };

  const handleRenameClick = () => {
    if (selectedIds.size !== 1) {
      showToast(s.select_single_item_required);
      return;
    }
    const id = Array.from(selectedIds)[0];
    go('recent.modal.rename.open.fromBase', { itemId: id }, { popSteps: 2 });
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

  const selectionMoreOptions = [
    { label: s.menu_copy, onClick: () => openTransferSheet('copy') },
    { label: s.menu_set_private, onClick: () => { showToast(setPrivate(getSelectedNodes()) ? s.toast_private_added : s.toast_action_unavailable); closeModal(); } },
    { label: s.menu_favorite, onClick: () => { showToast(addFavorites(getSelectedNodes()) ? s.toast_added_to_favorites : s.toast_favorite_failed); closeModal(); } },
    { label: s.menu_rename, onClick: handleRenameClick },
    { label: s.menu_compress, onClick: () => { showToast(s.toast_action_unavailable); closeModal(); } },
    { label: s.menu_details, onClick: handleShowDetails },
  ];

  return (
    <FileManagerReferenceShell section="recent" selecting={isSelecting} settingsBindings={bindTap('settings.open')}>
    <div className="h-full bg-app-surface flex flex-col relative overflow-hidden">
      <div inert={!!modal} style={{ display: 'contents' }}>
      {!isSelecting ? <FileManagerReferenceHeader title={s.tab_recent} searchBindings={bindTap('search.open')} count={items.length} /> : null}
      <div className="fm-compact-toolbar">
      <CollapsingToolbar
        title={isSelecting ? (selectedIds.size > 0 ? `${s.selected_prefix}${selectedIds.size}${s.item_count_suffix}` : s.select_items_prompt) : s.tab_recent}
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
        ) : undefined}
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
          title={isSelecting ? (selectedIds.size > 0 ? `${s.selected_prefix}${selectedIds.size}${s.item_count_suffix}` : s.select_items_prompt) : s.tab_recent}
          scrollTop={scrollTop}
        />
        </div>
        
        {groupedItems.map(([date, groupItems], index) => {
          const isCollapsed = collapsedGroups.has(date);
          return (
            <div key={date}>
              {index > 0 && <div className="mx-6 h-[0.5px] bg-gray-100" />}
              <div className="mb-6 mt-4 px-6">
                <button onClick={() => toggleGroup(date)} className="w-full flex items-center justify-between py-2 active:opacity-60 transition-opacity">
                  <div className="flex items-center gap-2">
                    <span className="text-[18px] font-medium text-gray-400">{date}</span>
                    <span className="text-[18px] text-gray-300">|</span>
                    <span className="text-[18px] font-medium text-gray-400">{groupItems.length}{s.item_count_suffix}</span>
                  </div>
                  {isCollapsed ? <IcExpand size={20} className="text-gray-400" /> : <IcCollapse size={20} className="text-gray-400" />}
                </button>
                {!isCollapsed && (
                  <div className="fm-recent-grid grid grid-cols-4 gap-x-2 gap-y-6 mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {groupItems.map(item => {
                      const isSelected = selectedIds.has(item.id);
                      const isImage = item.mimeType?.startsWith('image/');
                      const Icon = isImage ? null : getFileIcon(item);
                      const iconColor = isImage ? '' : getFileIconColor(item);
                      return (
                        <div key={item.id}
                          onClick={() => handleItemClick(item)}
                          onContextMenu={(e) => e.preventDefault()}
                          {...bindItemPress(item)}
                          data-file-item-id={item.id}
                          data-selected={isSelected}
                          {...(isImage ? {
                            'data-action': 'file.image.open',
                            'data-action-type': 'open',
                            'data-action-params': JSON.stringify({ path: item.path }),
                          } : {})}
                          className="flex flex-col items-center gap-1 active:opacity-70 transition-opacity relative">
                          <div className={`w-full aspect-square bg-gray-50 rounded-xl overflow-hidden relative border ${isSelected ? 'border-app-primary shadow-[0_0_0_1px_var(--app-primary)]' : 'border-gray-100/50'} flex items-center justify-center`}>
                            {isImage ? <AsyncImage path={item.path} nodeId={item.id} className="w-full h-full object-cover" /> :
                              Icon && <Icon size={36} className={iconColor} strokeWidth={1.5} />}
                            {isSelecting && (
                              <div className="absolute top-1 right-1">
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-app-primary border-app-primary' : 'bg-white/80 border-gray-300'}`}>
                                  {isSelected && <IcCheck size={12} className="text-white" strokeWidth={4} />}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-[13px] text-app-text font-medium text-center leading-tight line-clamp-2 px-0.5 mt-1 break-all">{truncateFileName(item.name)}</div>
                          <div className="text-[11px] text-gray-400 font-normal scale-95 origin-top">{FileSystem.formatFileSize(item.size)}</div>
                          <div className="text-[11px] text-gray-400 font-normal scale-95 origin-top">{getSourceLabel(item.path)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!isSelecting && <div style={{ height: 'var(--app-main-tab-bar-height)' }} />}
      </div>

      {isSelecting && (() => {
        const hasSelection = selectedIds.size > 0;
        const actionBtn = `flex flex-col items-center gap-1.5 px-4 transition-opacity ${hasSelection ? 'active:opacity-60' : 'opacity-40'}`;
        return (
        <div
          className="absolute bottom-0 left-0 right-0 bg-app-surface flex items-center justify-around pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] z-40 animate-in slide-in-from-bottom-10 duration-200"
          style={{ minHeight: 'var(--app-selection-action-bar-height)' }}
        >
          <button
            disabled={!hasSelection}
            {...bindTap({ kind: 'action', id: 'recent.select.send' }, { onTrigger: () => {
              const outcome = shareNodesAsImages([...selectedIds], shareSources,
                () => ownsPage() && isSelecting && !modal && liveSelection.current === selectedIds);
              if (outcome === 'unsupported') showToast(s.toast_send_no_image);
              else if (outcome === 'source-changed') showToast(s.toast_send_source_changed);
              else if (outcome === 'unavailable') showToast(s.toast_send_unavailable);
            } })}
            className={actionBtn}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <IcShare />
            </div>
            <span className="text-[12px] text-app-text">{s.action_send}</span>
          </button>
          <button disabled={!hasSelection} onClick={() => openTransferSheet('move')} className={actionBtn}>
            <div className="w-6 h-6 flex items-center justify-center">
              <IcMove />
            </div>
            <span className="text-[12px] text-app-text">{s.action_move}</span>
          </button>
          <button disabled={!hasSelection} onClick={() => openModal('delete')} className={actionBtn}>
            <div className="w-6 h-6 flex items-center justify-center">
              <IcDelete />
            </div>
            <span className="text-[12px] text-app-text">{s.action_delete}</span>
          </button>
          <button disabled={!hasSelection} onClick={() => openModal('more')} className={actionBtn}>
            <div className="w-6 h-6 flex items-center justify-center">
              <IcMoreCircle />
            </div>
            <span className="text-[12px] text-app-text">{s.action_more}</span>
          </button>
        </div>
        );
      })()}

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

export default RecentPage;
