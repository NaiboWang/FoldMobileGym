import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { IcPlayCircle, IcAdd, IcCheck } from '../res/icons';
import { useBilibiliStore } from '../state';
import { useBilibiliEntryOwner } from '../hooks/useBilibiliEntryOwner';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
import { captureFavoriteSelection, favoriteSelectionIsCurrent, type FavoriteSelection } from '../utils/favoriteSelection';
import { realNow } from '../../../os/TimeService';
import { favoriteSheetTop, favoriteSheetDragTop, favoriteSheetDrop, type FavoriteSheetSnap } from '../utils/favoriteSheetGeometry';

interface FavToastProps {
  visible: boolean;
  onModify: () => void;
}

export const FavToast: React.FC<FavToastProps> = ({ visible, onModify }) => {
  return (
    <div
      className={`fixed bottom-16 left-0 right-0 z-[200] flex justify-center transition-all duration-300 pointer-events-none ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className={`bg-[#323232] text-white rounded-lg px-4 py-2.5 mx-4 flex items-center justify-between w-full max-w-sm shadow-lg ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <IcCheck size={16} className="text-green-400" />
          <span className="text-[13px]">已加入"默认收藏夹"</span>
        </div>
        <button
          className="text-app-primary text-[13px] font-medium active:opacity-70"
          onClick={onModify}
        >
          修改收藏夹
        </button>
      </div>
    </div>
  );
};

type SnapPoint = FavoriteSheetSnap;

interface FavSheetProps {
  visible: boolean;
  videoId: string;
  onClose: () => void;
  onCreateFolder: () => void;
  pendingNewFolderId?: string | null;
}

export const FavSheet: React.FC<FavSheetProps> = ({ visible, videoId, onClose, onCreateFolder, pendingNewFolderId }) => {
  const biliUser = useBilibiliStore(s => s.user);
  const setFavFolders = useBilibiliStore(s => s.setFavFolders);
  const folders = biliUser.favoritesFolders || [];
  const ownsEntry = useBilibiliEntryOwner(), strings = useBilibiliStrings();
  const latestUser = useRef(biliUser); latestUser.current = biliUser;
  const submitting = useRef(false);
  const [selection, setSelection] = useState<FavoriteSelection>({ videoId: '', sourceKey: null, selectedIds: new Set() });
  const selectedIds = selection.selectedIds;
  const available = favoriteSelectionIsCurrent(biliUser, videoId, selection);
  const [snap, setSnap] = useState<SnapPoint>('half');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hostHeight, setHostHeight] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ pointerId: number; y: number; snapY: number; time: number; scale: number; height: number; left: number; top: number; width: number; element: HTMLDivElement } | null>(null);
  const cancelDrag = useCallback((update = true) => {
    const drag = dragStartRef.current; dragStartRef.current = null;
    if (drag) { try { if (drag.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId); } catch { /* Removed Activity. */ } }
    if (update) setIsDragging(false);
  }, []);

  useEffect(() => {
    session.current++;
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    cancelDrag();
    if (!visible) return;
    submitting.current = false;
    setSelection(captureFavoriteSelection(latestUser.current, videoId, pendingNewFolderId));
    setSnap('half'); setDragY(0); setIsDragging(false);
  }, [visible, videoId, pendingNewFolderId, cancelDrag]);
  useEffect(() => () => {
    session.current++;
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    cancelDrag(false);
  }, [cancelDrag]);
  useLayoutEffect(() => {
    if (!visible || !sheetRef.current) return;
    const host = sheetRef.current.parentElement;
    if (!host) return;
    const measure = () => {
      const height = parseFloat(getComputedStyle(host).height) || host.clientHeight;
      if (Number.isFinite(height) && height > 0) {
        const bounds = host.getBoundingClientRect(), drag = dragStartRef.current;
        if (drag && (Math.abs(height - drag.height) > 0.5 || Math.abs(bounds.height / height - drag.scale) > 0.001)) cancelDrag();
        setHostHeight(height);
      }
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(host);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [visible, cancelDrag]);

  const getSnapY = useCallback((s: SnapPoint): number => {
    return favoriteSheetTop(hostHeight, s);
  }, [hostHeight]);

  const currentY = isDragging ? dragY : getSnapY(snap);
  const closeSheet = useCallback(() => {
    if (!visible || !ownsEntry()) return;
    submitting.current = true;
    setSnap('closed');
    const ownSession = session.current;
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      if (session.current === ownSession) onClose();
    }, 300);
  }, [visible, ownsEntry, onClose]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    if (!visible || !ownsEntry() || !e.isPrimary || e.button !== 0) return;
    const host = sheetRef.current?.parentElement;
    if (!host) return;
    const height = parseFloat(getComputedStyle(host).height) || host.clientHeight;
    const bounds = host.getBoundingClientRect(), scale = bounds.height / height;
    if (!(height > 0 && Number.isFinite(scale) && scale > 0)) return;
    cancelDrag();
    const snapY = favoriteSheetTop(height, snap);
    const element = e.currentTarget as HTMLDivElement;
    dragStartRef.current = { pointerId: e.pointerId, y: e.clientY, snapY, time: realNow(), scale, height, left: bounds.left, top: bounds.top, width: bounds.width, element };
    setDragY(snapY);
    setIsDragging(true);
    element.setPointerCapture(e.pointerId);
  }, [snap, visible, ownsEntry, cancelDrag]);

  const currentDrag = (event: React.PointerEvent) => {
    const drag = dragStartRef.current, host = sheetRef.current?.parentElement;
    if (!drag || drag.pointerId !== event.pointerId || !host) return null;
    const height = parseFloat(getComputedStyle(host).height) || host.clientHeight;
    const bounds = host.getBoundingClientRect();
    if (!ownsEntry() || Math.abs(height - drag.height) > 0.5 || Math.abs(bounds.height / height - drag.scale) > 0.001
      || Math.abs(bounds.left - drag.left) > 0.5 || Math.abs(bounds.top - drag.top) > 0.5 || Math.abs(bounds.width - drag.width) > 0.5) {
      cancelDrag(); return null;
    }
    return drag;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = currentDrag(e);
    if (drag) setDragY(favoriteSheetDragTop(drag.height, drag.snapY, e.clientY - drag.y, drag.scale));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const drag = currentDrag(e);
    if (!drag) return;
    const top = favoriteSheetDragTop(drag.height, drag.snapY, e.clientY - drag.y, drag.scale);
    const velocity = (e.clientY - drag.y) / drag.scale / Math.max(1, realNow() - drag.time);
    const next = favoriteSheetDrop(drag.height, top, velocity);
    cancelDrag();
    if (next === 'closed') closeSheet(); else setSnap(next);
  };

  const toggleFolder = (folderId: string) => {
    if (!visible || !ownsEntry() || submitting.current || !favoriteSelectionIsCurrent(useBilibiliStore.getState().user, videoId, selection)) return;
    setSelection(prev => {
      const next = new Set(prev.selectedIds);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return { ...prev, selectedIds: next };
    });
  };

  const handleDone = () => {
    if (!visible || !ownsEntry() || submitting.current || !favoriteSelectionIsCurrent(useBilibiliStore.getState().user, videoId, selection)) return;
    submitting.current = true;
    setFavFolders(videoId, Array.from(selectedIds));
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[300]" data-bili-fav-sheet>
      <div
        className="absolute inset-0 bg-black/40"
        style={{ transition: 'opacity 300ms' }}
        onClick={closeSheet}
      />
      <div
        ref={sheetRef}
        data-bili-fav-panel
        data-bili-fav-height={hostHeight}
        data-bili-fav-dragging={isDragging}
        data-bili-fav-snap={snap}
        className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl flex flex-col overflow-hidden"
        style={{
          top: `${currentY}px`,
          transition: isDragging ? 'none' : 'top 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'top',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => cancelDrag()}
      >
        {/* drag handle */}
        <div data-bili-fav-handle className="flex justify-center py-3 cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }}>
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* "添加到稍后再看" */}
        <div className="flex items-center gap-3 px-4 pb-3 border-b border-gray-100" data-no-drag>
          <IcPlayCircle size={20} className="text-gray-600" />
          <span className="text-[15px] text-gray-800">添加到稍后再看</span>
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2" data-no-drag>
          <span className="text-[15px] font-medium">选择收藏夹</span>
          <button
            type="button"
            data-bili-fav-create
            disabled={!available}
            className="flex items-center gap-1 text-[13px] text-gray-500 active:opacity-70"
            onClick={() => { if (visible && ownsEntry() && !submitting.current && favoriteSelectionIsCurrent(useBilibiliStore.getState().user, videoId, selection)) onCreateFolder(); }}
          >
            <IcAdd size={14} />
            <span>新建收藏夹</span>
          </button>
        </div>

        {/* folder list */}
        {selection.videoId === videoId && !available && <p role="status" data-bili-fav-conflict className="px-4 py-2 text-[12px] text-app-text-muted">{strings.favorite_selection_conflict}</p>}
        <div className="flex-1 overflow-y-auto min-h-0 px-4" data-no-drag>
          {folders.map((folder, index) => {
            const checked = selectedIds.has(folder.id);
            const count = (folder.videoIds || []).length;
            return (
              <button type="button" role="checkbox" aria-checked={checked} disabled={!available}
                data-bili-fav-folder={folder.id}
                key={`${folder.id}-${index}`}
                className="w-full text-left flex items-center justify-between py-3.5 active:bg-gray-50 cursor-pointer"
                onClick={() => toggleFolder(folder.id)}
              >
                <div>
                  <div className="text-[15px] text-gray-800">{folder.title}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">
                    {count}个内容 · {folder.isPublic ? '公开' : '私密'}
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-app-primary border-app-primary' : 'border-gray-300'}`}
                >
                  {checked && <IcCheck size={12} className="text-white" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* done button */}
        <div className="px-4 py-3 pb-safe border-t border-gray-100" data-no-drag>
          <button
            type="button" disabled={!available} data-bili-fav-done
            className="w-full py-2.5 text-center text-[15px] font-medium text-gray-800 active:bg-gray-50 rounded-lg"
            onClick={handleDone}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
