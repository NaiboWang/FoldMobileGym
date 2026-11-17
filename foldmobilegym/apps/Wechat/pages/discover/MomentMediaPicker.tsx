import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { dimens } from '../../res/dimens';
import { IcExpand, IcCollapse, IcSearch, IcClose, IcCheck, IcNavBack } from '../../res/icons';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import * as MediaService from '../../../../os/MediaService';
import type { Album, MediaItem } from '../../../../os/types';
import { usePickerSession } from '../../hooks/usePickerSession';
import { capturePickerFile, capturePickerIdentity, validatePickerFiles, sourceIsCurrent, type PickerFileSource, type PickerFileIdentity } from '../../utils/pickerFileSource';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { WechatSmartImage } from '../../components/WechatSmartImage';

const MAX_SELECT = 9;
const SWIPE_THRESHOLD = 40;

export const MomentMediaPickerPage: React.FC = () => {
  const t = useWechatStrings();
  const location = useLocation();
  const { id: targetWxid } = useParams<{ id?: string }>();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const menu = searchParams.get('menu');
  const albumId = searchParams.get('albumId') || 'all';
  const scope = searchParams.get('scope') || 'all';
  const urlIndex = Number(searchParams.get('index') || '0');
  const isChatMediaPicker = /^\/chat\/[^/]+\/media-picker$/.test(location.pathname);


  const { momentDraft, updateMomentDraft, sendImages } = useWechatStore(useShallow(s => ({
    momentDraft: s.momentDraft,
    updateMomentDraft: s.updateMomentDraft,
    sendImages: s.sendImages,
  })));

  const [albums, setAlbums] = useState<Album[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAlbumId, setPendingAlbumId] = useState<string | null>(null);
  const [showPreviewChrome, setShowPreviewChrome] = useState(true);
  const swipeStartXRef = useRef<{id:number;x:number;y:number}|null>(null);
  const sourceFiles = useRef(new Map<string, PickerFileSource>());
  const viewSources = useRef(new Map<string, PickerFileIdentity | null>());
  const selectedObjects = useRef(new Map<string, MediaItem>()), selectedCurrent = useRef<string[]>([]);
  const loadItems = useCallback(() => {
    const list=MediaService.getMediaItems({albumId,type:'image'}).sort((a,b)=>b.createdAt-a.createdAt);
    viewSources.current=new Map(list.map(item=>[item.id,capturePickerIdentity(item.path,item.id)]));
    return list;
  },[albumId]);
  const session = usePickerSession(isChatMediaPicker ? targetWxid ?? '' : null, () => { sourceFiles.current.clear(); selectedObjects.current.clear(); selectedCurrent.current=[]; setSelectedIds([]); setItems(loadItems()); });
  const { bindTap, bindBack, go, back } = session;
  const guardClick = <T extends HTMLElement>(action:()=>void)=>(event:React.SyntheticEvent<T>)=>{ if(session.canEdit()&&!event.currentTarget.closest('[inert]')){event.stopPropagation();action();} };


  const currentAlbum = useMemo(() => albums.find(a => a.id === albumId) || null, [albums, albumId]);
  const currentAlbumName = currentAlbum?.id === 'all' ? t.moment_media_album_all : currentAlbum?.name || t.moment_media_album_all;

  useEffect(() => {
    setAlbums(MediaService.getAlbums());
  }, []);

  useEffect(() => {
    if (menu === 'albums' || menu === 'preview') return;
    if (searchParams.get('albumId')) return;
    if (isChatMediaPicker && targetWxid) {
      go('chat.mediaPicker.defaultAlbum.replace', { id: targetWxid, albumId: 'all' });
      return;
    }
    go('moments.mediaPicker.defaultAlbum.replace', { albumId: 'all' });
  }, [go, isChatMediaPicker, menu, searchParams, targetWxid]);

  useEffect(() => { setItems(loadItems()); }, [loadItems]);

  useEffect(() => {
    if (!pendingAlbumId) return;
    if (menu === 'albums') return;
    if (isChatMediaPicker && targetWxid) {
      go('chat.mediaPicker.album.switch', { id: targetWxid, albumId: pendingAlbumId });
    } else {
      go('moments.mediaPicker.album.switch', { albumId: pendingAlbumId });
    }
    setPendingAlbumId(null);
  }, [go, isChatMediaPicker, menu, pendingAlbumId, targetWxid]);

  const selectedItems = useMemo(() => selectedIds.map(id=>selectedObjects.current.get(id)).filter((value):value is MediaItem=>!!value),[selectedIds]);

  const previewList = useMemo(() => {
    if (menu !== 'preview') return [];
    if (scope === 'selected') return selectedItems;
    return items;
  }, [items, menu, scope, selectedItems]);

  const previewIndex = Math.min(Number.isFinite(urlIndex)?Math.max(0,Math.floor(urlIndex)):0,Math.max(0,previewList.length-1));
  const setPreviewIndex = (value:number|((current:number)=>number)) => {
    if(!session.canEdit()||menu!=='preview'||!previewList.length)return;
    const next=Math.max(0,Math.min(previewList.length-1,typeof value==='function'?value(previewIndex):value));
    if(next===previewIndex)return;
    if(isChatMediaPicker&&targetWxid)go('chat.mediaPicker.preview.index.replace',{id:targetWxid,index:next,scope});
    else go('moments.mediaPicker.preview.index.replace',{index:next,scope});
  };
  useEffect(()=>{if(menu==='preview')setShowPreviewChrome(true);},[menu,urlIndex]);

  const toggleSelect = (item: MediaItem) => {
    if (!session.canEdit() || menu === 'albums') return;
    const existing=selectedCurrent.current;
    if(existing.includes(item.id)){
      sourceFiles.current.delete(item.id);selectedObjects.current.delete(item.id);
      selectedCurrent.current=existing.filter(id=>id!==item.id);
    }else{
      if(existing.length>=MAX_SELECT)return;
      const captured=capturePickerFile(item.path,true,item.id,viewSources.current.get(item.id)??null);
      if(!captured){session.fail();return;}
      sourceFiles.current.set(item.id,captured);selectedObjects.current.set(item.id,item);
      selectedCurrent.current=[...existing,item.id];
    }
    setSelectedIds(selectedCurrent.current);
  };

  const selectionProps=(item:MediaItem|undefined,preview:boolean)=>{
    if(!item)return {};
    const options={params:{fileId:item.id,path:item.path},stopPropagation:true,onTrigger:()=>toggleSelect(item)};
    if(isChatMediaPicker){
      if(preview)return bindTap<HTMLButtonElement>({kind:'action',id:'chat.mediaPicker.preview.item.toggle'},options);
      return bindTap<HTMLButtonElement>({kind:'action',id:'chat.mediaPicker.base.item.toggle'},options);
    }
    if(preview)return bindTap<HTMLButtonElement>({kind:'action',id:'moments.mediaPicker.preview.item.toggle'},options);
    return bindTap<HTMLButtonElement>({kind:'action',id:'moments.mediaPicker.base.item.toggle'},options);
  };
  const handlePrimaryAction = async () => {
    if(menu==='albums')return;
    if (!selectedItems.length || selectedItems.length !== selectedIds.length) return;
    const claim = session.begin(); if (!claim) return;
    const sources = selectedItems.map(item => sourceFiles.current.get(item.id));
    if (sources.some(source => !source) || !await validatePickerFiles(sources as PickerFileSource[])) { session.finish(claim, true); return; }
    if (!session.valid(claim)) { session.finish(claim); return; }
    if (!(sources as PickerFileSource[]).every(sourceIsCurrent)) { session.finish(claim,true); return; }
    session.commit(claim, () => {
      if (isChatMediaPicker && targetWxid) {
        sendImages(targetWxid, selectedItems.map(item => item.path));
        const steps=session.chatReturnSteps();
        if(steps)back(steps);else go('chat.mediaPicker.chat.return',{id:targetWxid});
      } else {
        const merged = [...momentDraft.selectedImages, ...selectedItems.map(item => item.path)];
        updateMomentDraft({ selectedImages: [...new Set(merged)].slice(0,MAX_SELECT) });
        go('moments.post.open.fromMediaPicker');
      }
    });
  };
  const handlePreviewPrimaryAction = handlePrimaryAction;

  const openPreview = (index: number, previewScope: 'all' | 'selected') => {
    if(!session.canEdit()||menu==='albums')return;
    if (isChatMediaPicker && targetWxid) {
      go('chat.mediaPicker.preview.open', { id: targetWxid, index, scope: previewScope },{mode:menu==='preview'?'replace':'push'});
      return;
    }
    go('moments.mediaPicker.preview.open', { index, scope: previewScope },{mode:menu==='preview'?'replace':'push'});
  };


  const handleSwipeStart = (event:React.PointerEvent<HTMLDivElement>) => {
    if(!session.canEdit()||!event.isPrimary||event.button!==0)return;
    swipeStartXRef.current={id:event.pointerId,x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleSwipeEnd = (event:React.PointerEvent<HTMLDivElement>) => {
    const start=swipeStartXRef.current;swipeStartXRef.current=null;
    if(!session.canEdit()||!start||start.id!==event.pointerId)return;
    const delta=event.clientX-start.x;
    if(Math.abs(delta)<SWIPE_THRESHOLD||Math.abs(delta)<Math.abs(event.clientY-start.y))return;
    const next=delta<0?Math.min(previewIndex+1,previewList.length-1):Math.max(0,previewIndex-1);
    if(next===previewIndex)return;
    if(isChatMediaPicker&&targetWxid)go('chat.mediaPicker.preview.swipe',{id:targetWxid,index:next,scope});
    else go('moments.mediaPicker.preview.swipe',{index:next,scope});
  };

  const overlayTop = 'top-[92px]';
  const centerLabel = isChatMediaPicker ? t.chat_original_image : t.moment_media_make_video;
  const primaryLabel = isChatMediaPicker ? t.chat_send : t.moment_media_done;
  const previewCloseProps = bindBack<HTMLButtonElement>({stopPropagation:true});

  const albumMenuOpenProps =
    isChatMediaPicker && targetWxid
      ? bindTap<HTMLButtonElement>('chat.mediaPicker.albumMenu.open', { params: { id: targetWxid } })
      : bindTap<HTMLButtonElement>('moments.mediaPicker.albumMenu.open');

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-black flex flex-col" data-status-bar-foreground="light">
      {session.error && <p role="alert" className="absolute left-3 right-3 top-12 z-[300] p-3 bg-white text-red-700 text-sm">{t.chat_picker_source_changed}</p>}
      {session.busy && <p role="status" className="absolute left-3 top-12 z-[300] text-white">{t.chat_picker_checking}</p>}
      {menu === 'preview' ? (
        <div className="relative flex-1 min-h-0 w-full bg-black">
          <div
            className="absolute inset-0 z-0 select-none"
            style={{touchAction:'none'}}
            onDragStart={event=>event.preventDefault()}
            data-trigger={isChatMediaPicker?'chat.mediaPicker.preview.swipe':'moments.mediaPicker.preview.swipe'} data-trigger-type="swipe"
            onClick={guardClick(()=>setShowPreviewChrome(v=>!v))}
            onPointerDown={handleSwipeStart}
            onPointerUp={handleSwipeEnd}
            onPointerCancel={()=>{swipeStartXRef.current=null;}}
            onLostPointerCapture={()=>{swipeStartXRef.current=null;}}
          >
            {previewList[previewIndex] ? (
              <WechatSmartImage
                src={previewList[previewIndex].path}
                className="w-full h-full object-contain"
                alt=""
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50">{t.moment_media_no_content}</div>
            )}
          </div>

          {showPreviewChrome && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="pointer-events-auto absolute top-0 left-0 right-0 pt-10 px-4 pb-3 flex items-center justify-between bg-black/60">
                <button
                  {...previewCloseProps}
                  className="w-10 h-10 flex items-center justify-center"
                >
                  <IcNavBack size={dimens.icSizeNav} className="text-white" />
                </button>

                <div className="text-white text-(--app-title-text-size-18) font-medium">
                  {previewList.length === 0 ? '0/0' : `${previewIndex + 1}/${previewList.length}`}
                </div>

                <button
                  {...selectionProps(previewList[previewIndex],true)} disabled={!previewList[previewIndex]}
                  className="flex items-center gap-2 h-10 px-2 active:opacity-80"
                >
                  <span className="text-white text-(--app-chat-bubble-text-size)">{t.moment_media_select}</span>
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                      (() => {
                        const item = previewList[previewIndex];
                        const selected = item ? selectedIds.includes(item.id) : false;
                        return selected ? 'bg-app-primary border-app-primary' : 'border-white/70 bg-black/20';
                      })()
                    }`}
                  >
                    {(() => {
                      const item = previewList[previewIndex];
                      const selected = item ? selectedIds.includes(item.id) : false;
                      return selected ? <IcCheck size={dimens.icSizeChevronSm} className="text-white" /> : null;
                    })()}
                  </div>
                </button>
              </div>

              <div className="pointer-events-auto absolute left-0 right-0 bottom-0">
                {selectedItems.length > 0 && (
                  <div className="h-(--app-card-height-78) bg-black/40 px-2 flex items-center overflow-x-auto no-scrollbar gap-2" data-scroll-container="selectedMedia" data-scroll-direction="horizontal">
                    {selectedItems.map(si => {
                      const idxInPreview = previewList.findIndex(x => x.id === si.id);
                      const isActive = previewList[previewIndex]?.id === si.id;
                      return (
                        <button
                          key={si.id}
                          onClick={e => {
                            e.stopPropagation();
                            if (session.canEdit() && idxInPreview >= 0) setPreviewIndex(idxInPreview);
                          }}
                          className={`relative w-(--app-card-width-60) h-(--app-item-height-60) rounded-[4px] overflow-hidden flex-shrink-0 ${
                            isActive ? 'ring-2 ring-app-primary' : ''
                          }`}
                        >
                          <WechatSmartImage src={si.path} className="w-full h-full object-cover" alt="" />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="h-(--app-settings-item-height) bg-black/60 flex items-center px-4 border-t border-white/10 relative">
                  <button
                    onClick={e => e.stopPropagation()}
                    className="text-(--app-chat-bubble-text-size) text-white/70"
                    disabled
                  >
                    {t.moment_media_edit}
                  </button>

                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 pointer-events-none">
                    <div className="w-4 h-4 rounded-full border border-white/40" />
                    <span className="text-white/60 text-(--app-chat-bubble-text-size)">{centerLabel}</span>
                  </div>

                  {isChatMediaPicker && targetWxid ? (
                    <button
                      {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'chat.mediaPicker.preview.send' }, {
                        params: { id: targetWxid },
                        onTrigger: handlePreviewPrimaryAction,
                        stopPropagation: true,
                      })}
                      disabled={selectedIds.length === 0 || session.busy}
                      className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                        selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                      }`}
                    >
                      {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
                    </button>
                  ) : (
                    <button
                      {...bindTap<HTMLButtonElement>('moments.post.open.fromMediaPicker', {
                        onTrigger: handlePreviewPrimaryAction,
                        stopPropagation: true,
                      })}
                      disabled={selectedIds.length === 0 || session.busy}
                      className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                        selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                      }`}
                    >
                      {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="pt-10 px-4 pb-3 flex items-center justify-between bg-black/95">
            <button
              {...bindBack<HTMLButtonElement>()}
              className="w-10 h-10 flex items-center justify-center"
            >
              <IcClose size={dimens.icSizeClose} className="text-white" />
            </button>

            {menu === 'albums' ? (
              <button
                {...bindBack<HTMLButtonElement>()}
                className="flex items-center gap-1 text-white text-(--app-settings-item-text-size) font-medium"
              >
                <span className="max-w-[11rem] truncate">{currentAlbumName}</span>
                <IcCollapse size={dimens.icSizeCheck} className="text-white/70" />
              </button>
            ) : (
              <button
                {...albumMenuOpenProps}
                className="flex items-center gap-1 text-white text-(--app-settings-item-text-size) font-medium"
              >
                <span className="max-w-[11rem] truncate">{currentAlbumName}</span>
                <IcExpand size={dimens.icSizeChevronLg} className="text-white/70" />
              </button>
            )}

            <button className="w-10 h-10 flex items-center justify-center active:opacity-80">
              <IcSearch size={dimens.icSizeToolbar} className="text-white" />
            </button>
          </div>

          {menu === 'albums' && (
            <div className="absolute inset-0 z-[300]">
              <div
                {...bindBack<HTMLDivElement>({ stopPropagation: true })}
                className={`absolute inset-0 ${overlayTop} bg-black/40`}
              />
              <div className={`absolute left-0 right-0 ${overlayTop} bg-(--app-c-common-text-primary)`}>
                {albums.map(album => {
                  const title = album.id === 'all' ? t.moment_media_album_all : album.name;
                  const isCurrent = album.id === albumId;
                  const albumSwitchProps =
                    isChatMediaPicker && targetWxid
                      ? bindTap<HTMLButtonElement>('chat.mediaPicker.album.switch', {
                          params: { id: targetWxid, albumId: album.id },
                          onTrigger: () => {
                            setPendingAlbumId(album.id);
                            back();
                          },
                        })
                      : bindTap<HTMLButtonElement>('moments.mediaPicker.album.switch', {
                          params: { albumId: album.id },
                          onTrigger: () => {
                            setPendingAlbumId(album.id);
                            back();
                          },
                        });

                  return (
                    <button
                      key={album.id}
                      {...albumSwitchProps}
                      className="w-full flex items-center px-5 py-4 active:bg-white/5"
                    >
                      <div className="flex-1 text-left">
                        <div className="text-white text-(--app-title-text-size-18) leading-none break-words [overflow-wrap:anywhere]">
                          {title}{' '}
                          <span className="text-white/40 text-(--app-chat-bubble-text-size)">({album.count})</span>
                        </div>
                      </div>
                      {isCurrent && <IcCheck size={dimens.icSizeToolbar} className="text-app-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto" inert={menu==='albums'} data-scroll-container="main" data-scroll-direction="vertical">
            <div className="grid grid-cols-4 gap-(--app-discover-moment-media-picker-gap-2) p-(--app-discover-moment-media-picker-padding-2)">
              {items.map((item, idx) => {
                const order = selectedIds.indexOf(item.id);
                const isSelected = order >= 0;
                return (
                  <div
                    key={item.id}
                    className="relative aspect-square bg-(--app-c-overlay-dark-bg) overflow-hidden"
                    onClick={guardClick(()=>openPreview(idx, 'all'))}
                  >
                    <WechatSmartImage key={`${item.id}:${viewSources.current.get(item.id)?.revision}`}
                      src={item.path}
                      className="w-full h-full object-cover"
                      alt={item.name}
                    />

                    <button
                      {...selectionProps(item,false)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full border-2 border-white/70 bg-black/20 flex items-center justify-center"
                    >
                      {isSelected && (
                        <div className="w-full h-full rounded-full bg-app-primary flex items-center justify-center">
                          <span className="text-white text-(--app-chat-time-label-text-size) font-semibold">{order + 1}</span>
                        </div>
                      )}
                    </button>

                    {isSelected && <div className="absolute inset-0 bg-black/20 pointer-events-none" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-(--app-settings-item-height) bg-(--app-c-common-text-primary) flex items-center px-4 border-t border-white/10 relative">
            <button
              disabled={selectedIds.length === 0 || session.busy}
              onClick={() => openPreview(0, 'selected')}
              className={`text-(--app-chat-bubble-text-size) ${
                selectedIds.length > 0 ? 'text-white' : 'text-white/30'
              }`}
            >
          {t.moment_media_preview}{selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 pointer-events-none">
              <div className="w-4 h-4 rounded-full border border-white/40" />
              <span className="text-white/60 text-(--app-chat-bubble-text-size)">{centerLabel}</span>
            </div>

            {isChatMediaPicker && targetWxid ? (
              <button
                {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'chat.mediaPicker.base.send' }, {
                  params: { id: targetWxid },
                  onTrigger: handlePrimaryAction,
                })}
                disabled={selectedIds.length === 0 || session.busy}
                className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                  selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                }`}
              >
                {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
              </button>
            ) : (
              <button
                {...bindTap<HTMLButtonElement>('moments.post.open.fromMediaPicker', {
                  onTrigger: () => { void handlePrimaryAction(); },
                })}
                disabled={selectedIds.length === 0 || session.busy}
                className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                  selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                }`}
              >
                {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
