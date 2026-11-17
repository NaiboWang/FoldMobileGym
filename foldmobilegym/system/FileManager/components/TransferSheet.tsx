import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { FSNode } from '@/os/types';
import * as FileSystem from '@/os/FileSystemService';
import { IcCheck, IcFolder, IcFolderAdd, IcNavBack, IcNavForward } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import type { TransferOperation } from '../utils/fileOperations';
import * as TimeService from '@/os/TimeService';
import { InputDialog } from './Dialog';
import { getTransferDragOffset } from '../utils/transferDrag';
import { normalizeTransferPath, TRANSFER_ROOT_PATH as ROOT_PATH } from '../utils/transferPath';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';

interface TransferSheetProps {
  open: boolean;
  operation: TransferOperation;
  selectedNodes: FSNode[];
  onClose: () => void;
  onConfirm: (destPath: string) => void;
  isCreateFolderOpen: boolean;
  onOpenCreateFolder: () => void;
  onCloseCreateFolder: () => void;
  onCreatedFolder?: () => void;
}

const DISMISS_THRESHOLD = 120;

export const TransferSheet: React.FC<TransferSheetProps> = ({
  open,
  operation,
  selectedNodes,
  onClose,
  onConfirm,
  isCreateFolderOpen,
  onOpenCreateFolder,
  onCloseCreateFolder,
  onCreatedFolder,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const location = useLocation();
  const { bindTap, bindBack } = useFileManagerGestures();
  const currentPath = normalizeTransferPath(new URLSearchParams(location.search).get('transferPath'));
  const bindDirectory = (path: string) => {
    if (location.pathname === '/') return bindTap('browse.transfer.folder.open', { params: { transferPath: path } });
    if (location.pathname === '/recent') return bindTap('recent.transfer.folder.open', { params: { transferPath: path } });
    return bindTap('folder.transfer.folder.open', { params: { transferPath: path } });
  };
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startY: 0, offset: 0, pointerId: null as number | null });
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dragRef.current = { startY: 0, offset: 0, pointerId: null };
    setIsDragging(false);
    setDragOffset(0);
  }, [open]);

  const folders = useMemo(() => {
    if (!open) return [];
    const selectedPaths = selectedNodes
      .filter(node => node.type === 'directory')
      .map(node => node.path);

    return FileSystem.listDirectory(currentPath)
      .filter(item => item.type === 'directory')
      .filter(item => !selectedPaths.some(path => item.path === path || item.path.startsWith(`${path}/`)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentPath, open, selectedNodes]);

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const result: { name: string; path: string }[] = [{ name: s.internal_storage_device, path: ROOT_PATH }];
    let path = '';
    parts.forEach((part, index) => {
      if (part === 'sdcard') return;
      path += `/${part}`;
      result.push({ name: part, path: `${index === 0 ? '' : ROOT_PATH}${path}` });
    });
    return result;
  }, [currentPath, s.internal_storage_device]);

  const title = operation === 'copy' ? s.transfer_copy_title : s.transfer_move_title;

  const formatDate = (timestamp: number) => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (dragRef.current.pointerId !== null || e.button !== 0) return;
    dragRef.current = { startY: e.clientY, offset: 0, pointerId: e.pointerId };
    setDragOffset(0);
    setIsDragging(true);
    barRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const maxOffset = typeof window !== 'undefined' ? window.innerHeight : 1000;
    const offset = getTransferDragOffset(dragRef.current.startY, e.clientY, maxOffset);
    dragRef.current.offset = offset;
    setDragOffset(offset);
  };

  const resetDrag = (e: React.PointerEvent) => {
    dragRef.current.pointerId = null;
    dragRef.current.offset = 0;
    setIsDragging(false);
    setDragOffset(0);
    if (barRef.current?.hasPointerCapture(e.pointerId)) {
      barRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const offset = dragRef.current.offset;
    resetDrag(e);
    if (offset >= DISMISS_THRESHOLD) onClose();
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    resetDrag(e);
  };

  const handleCreateFolder = async (name: string) => {
    if (!name) return false;
    const path = `${currentPath}/${name}`;
    if (FileSystem.exists(path)) return false;
    await FileSystem.createDirectory(path);
    onCreatedFolder?.();
    return true;
  };

  if (!open) return null;

  return (
    <div data-file-overlay="transfer" data-transfer-path={currentPath} role="dialog" aria-modal="true" aria-label={title} className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        inert={isCreateFolderOpen}
        className="absolute top-10 left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] px-5 pt-4 pb-6 flex flex-col"
        style={{ transform: `translateY(${dragOffset}px)`, transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined }}
        onPointerMove={handlePointerMove}
        onPointerLeave={e => e.buttons === 0 && handlePointerCancel(e)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
      >
        <div
          ref={barRef}
          className="flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handlePointerDown}
        >
          <div className="w-16 h-1 rounded-full bg-gray-300 -mt-1.5" aria-hidden />
        </div>

        <div className="flex items-center justify-between mb-4">
          <button className="w-10 h-10 flex items-center justify-center text-app-text shrink-0" {...bindBack()}>
            <IcNavBack size={28} />
          </button>
          <span className="text-[24px] font-medium flex-1 text-center truncate px-2">{title}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="w-10 h-10 flex items-center justify-center text-app-text"
              onClick={onOpenCreateFolder}
              aria-label={s.transfer_new_folder}
            >
              <IcFolderAdd size={28} />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center text-app-text"
              onClick={() => onConfirm(currentPath)}
              aria-label={s.dialog_confirm}
            >
              <IcCheck size={30} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap pb-3">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <IcNavForward size={15} className="text-gray-300 shrink-0" />}
              <button
                {...bindDirectory(crumb.path)}
                className={`px-4 py-2 rounded-full text-[14px] shrink-0 ${
                  index === breadcrumbs.length - 1 ? 'bg-amber-100 text-amber-600 font-medium' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-2" data-scroll-container="transfer" data-scroll-direction="vertical">
          {folders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-300">
              <IcFolder size={64} strokeWidth={1} className="mb-4" />
              <span className="text-[15px] text-app-text-muted text-center px-4">{s.transfer_no_subfolders}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  {...bindDirectory(folder.path)}
                  className="w-full flex items-center gap-4 px-1 py-4 active:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <IcFolder size={34} className="text-amber-500" fill="currentColor" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[18px] font-semibold text-app-text leading-tight mb-1 truncate">{folder.name}</div>
                    <div className="text-[14px] text-gray-400 flex items-center gap-2">
                      <span>{formatDate(folder.modifiedAt)}</span>
                      <span>|</span>
                      <span>{FileSystem.listDirectory(folder.path).length}{s.item_count_suffix}</span>
                    </div>
                  </div>
                  <IcNavForward size={22} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <InputDialog
        open={isCreateFolderOpen}
        onClose={onCloseCreateFolder}
        title={s.new_folder_title}
        placeholder={s.new_folder_placeholder}
        onConfirm={handleCreateFolder}
        confirmText={s.new_folder_confirm}
      />
    </div>
  );
};
