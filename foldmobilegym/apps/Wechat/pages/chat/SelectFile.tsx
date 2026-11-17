import { usePickerSession } from '../../hooks/usePickerSession';
import { capturePickerFile, capturePickerIdentity, validatePickerFiles, sourceIsCurrent, type PickerFileSource, type PickerFileIdentity } from '../../utils/pickerFileSource';
import React, { useMemo, useState, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useWechatStore } from '../../state';
import { WechatSmartImage } from '../../components/WechatSmartImage';
import { IcSearch, IcCircle, IcCheck, IcExpand, IcCollapse, IcFile, IcFolder, IcNavBack } from '../../res/icons';
import * as MediaService from '../../../../os/MediaService';
import * as FileSystem from '../../../../os/FileSystemService';
import * as TimeService from '../../../../os/TimeService';
import type { MediaItem, FSNode } from '../../../../os/types';
import type { Message, ChatSession } from '../../types';

const MAX_SELECT = 9;
const FILE_BROWSER_ROOT = '/sdcard';

type Tab = 'chat' | 'favorites' | 'album' | 'file';

type FileChoice = {
  // unique key for selection state
  key: string;
  // path used as message content
  path: string;
  // display name
  name: string;
  size: number;
  mimeType?: string;
  thumbnailPath?: string;
  visibleSource?: PickerFileIdentity | null;
  // optional source description
  fromLabel?: string;
  // group label like 今天/昨天/前30天
  groupLabel?: string;
};

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function startOfDay(d: Date): number {
  return TimeService.fromLocalParts(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayBucket(timestamp: number, t: ReturnType<typeof useWechatStrings>): string {
  const today = startOfDay(TimeService.getDate());
  const msgDay = startOfDay(TimeService.fromTimestamp(timestamp));
  const dayDiff = Math.round((today - msgDay) / 86400000);
  if (dayDiff <= 0) return t.selectFile_album_today;
  if (dayDiff === 1) return t.selectFile_album_yesterday;
  if (dayDiff <= 7) return t.selectFile_album_recent_7d;
  if (dayDiff <= 30) return t.selectFile_chat_recent_30d;
  const dt = TimeService.fromTimestamp(timestamp);
  return `${dt.getFullYear()}/${dt.getMonth() + 1}`;
}

function truncateName(name: string, max = 18): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  if (dot > 0 && name.length - dot <= 6) {
    const ext = name.slice(dot);
    const head = name.slice(0, max - ext.length - 3);
    return `${head}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

// ============================================================================
// Main page
// ============================================================================
export const SelectFilePage: React.FC = () => {
  const t = useWechatStrings();
  const location = useLocation();
  const { id: targetWxid } = useParams<{ id: string }>();


  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tab = (searchParams.get('tab') || 'chat') as Tab;
  const view = searchParams.get('view'); // 'browser' for the inline file browser
  const browserDir = searchParams.get('dir') || FILE_BROWSER_ROOT;
  const isExpanded = searchParams.get('selected') === 'expanded';

  const { chats, sendFiles } = useWechatStore(useShallow(s => ({
    chats: s.chats,
    sendFiles: s.sendFiles,
  })));

  // Selection is global (across tabs), keyed by file path.
  const [selected, setSelected] = useState<Record<string, FileChoice>>({});
  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const sourceFiles = useRef(new Map<string, PickerFileSource>());
  const session = usePickerSession(targetWxid ?? '', () => { sourceFiles.current.clear(); setSelected({}); });
  const { go, back, bindBack, bindTap } = session;


  const toggleChoice = (choice: FileChoice) => {
    if (!session.canEdit()) return;
    if (sourceFiles.current.has(choice.path)) sourceFiles.current.delete(choice.path);
    else {
      const captured=capturePickerFile(choice.path,false,undefined,choice.visibleSource);
      if(!captured || captured.meta.name!==choice.name || captured.meta.size!==choice.size || captured.meta.mimeType!==choice.mimeType){session.fail();return;}
      sourceFiles.current.set(choice.path,captured);
    }
    setSelected(prev => {
      const next = { ...prev };
      if (next[choice.path]) {
        delete next[choice.path];
      } else {
        if (Object.keys(next).length >= MAX_SELECT) return next;
        next[choice.path] = choice;
      }
      return next;
    });
  };

  const removeChoice = (path: string) => {
    if (!session.canEdit()) return;
    sourceFiles.current.delete(path);
    setSelected(prev => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const isSelectedPath = (path: string) => Boolean(selected[path]);
  const chatToggleProps=(choice:FileChoice)=>bindTap<HTMLButtonElement>({kind:'action',id:'chat.selectFile.chat.item.toggle'},{params:{path:choice.path},onTrigger:()=>toggleChoice(choice)});
  const albumToggleProps=(choice:FileChoice)=>bindTap<HTMLButtonElement>({kind:'action',id:'chat.selectFile.album.item.toggle'},{params:{path:choice.path},onTrigger:()=>toggleChoice(choice)});

  const handleSend = async () => {
    if (!targetWxid || !selectedList.length) return;
    const claim=session.begin();if(!claim)return;
    const sources=selectedList.map(choice=>sourceFiles.current.get(choice.path));
    if(sources.some(source=>!source)||!await validatePickerFiles(sources as PickerFileSource[])){session.finish(claim,true);return;}
    if(!session.valid(claim)){session.finish(claim);return;}
    if(!(sources as PickerFileSource[]).every(sourceIsCurrent)){session.finish(claim,true);return;}
    session.commit(claim,()=>{
      sendFiles(targetWxid,selectedList.map(choice=>({path:choice.path,name:choice.name,size:choice.size,mimeType:choice.mimeType})));
      const steps=session.chatReturnSteps();
      if(steps)back(steps);else go('chat.selectFile.chat.return',{id:targetWxid});
    });
  };

  // ----- Browser sub-view -----
  if (view === 'browser' && tab === 'file') {
    return (
      <FileBrowserView
        dir={browserDir}
        navigation={session}
        onPickFile={(node,visible) => {
          if(!session.canEdit())return;
          const captured=capturePickerFile(node.path,false,node.id,visible);
          if(!captured){session.fail();return;}
          sourceFiles.current.set(node.path,captured);
          setSelected(prev => {
            if (prev[node.path]) return prev;
            if (Object.keys(prev).length >= MAX_SELECT) return prev;
            return {
              ...prev,
              [node.path]: {
                key: node.path,
                path: node.path,
                name: node.name,
                size: node.size,
                mimeType: node.mimeType,
              },
            };
          });
          back(1);
        }}
      />
    );
  }

  return (
    <div
      className="relative flex flex-col h-full bg-app-bg"
      data-status-bar-foreground="dark"
    >
      {session.error && <p role="alert" className="px-4 pt-10 text-red-600 text-sm">{t.chat_picker_source_changed}</p>}
      {session.busy && <p role="status" className="px-4 text-sm">{t.chat_picker_checking}</p>}
      <div className="flex flex-col h-full min-h-0" inert={isExpanded}>
      {/* Top bar */}
      <div className="pt-10 flex items-center justify-between px-4 h-[88px] shrink-0 relative bg-app-bg">
        <button
          type="button"
          className="text-(--app-search-filter-text-size) text-app-text active:opacity-60"
          {...bindBack<HTMLButtonElement>()}
        >
          {t.selectFile_cancel}
        </button>
        <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none">
          <span className="text-[17px] font-medium text-app-text">{t.selectFile_title}</span>
        </div>
        <button
          type="button"
          className="w-10 h-10 -mr-2 flex items-center justify-center active:opacity-60"
          aria-label="search"
        >
          <IcSearch size={22} className="text-app-text" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-around px-2 pb-2 shrink-0 bg-app-bg">
        <TabButton
          active={tab === 'chat'}
          label={t.selectFile_tab_chat}
          tapProps={
            tab !== 'chat' && targetWxid
              ? bindTap<HTMLButtonElement>('chat.selectFile.tab.chat.switch', { params: { id: targetWxid } })
              : {}
          }
        />
        <TabButton
          active={tab === 'favorites'}
          label={t.selectFile_tab_favorites}
          tapProps={
            tab !== 'favorites' && targetWxid
              ? bindTap<HTMLButtonElement>('chat.selectFile.tab.favorites.switch', { params: { id: targetWxid } })
              : {}
          }
        />
        <TabButton
          active={tab === 'album'}
          label={t.selectFile_tab_album}
          tapProps={
            tab !== 'album' && targetWxid
              ? bindTap<HTMLButtonElement>('chat.selectFile.tab.album.switch', { params: { id: targetWxid } })
              : {}
          }
        />
        <TabButton
          active={tab === 'file'}
          label={t.selectFile_tab_file}
          tapProps={
            tab !== 'file' && targetWxid
              ? bindTap<HTMLButtonElement>('chat.selectFile.tab.file.switch', { params: { id: targetWxid } })
              : {}
          }
        />
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto bg-app-bg"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {tab === 'chat' && <ChatTabContent key={session.generation} chats={chats} isSelectedPath={isSelectedPath} onToggle={toggleChoice} toggleProps={chatToggleProps} />}
        {tab === 'favorites' && <FavoritesTabEmpty />}
        {tab === 'album' && <AlbumTabContent key={session.generation} isSelectedPath={isSelectedPath} onToggle={toggleChoice} toggleProps={albumToggleProps} />}
        {tab === 'file' && (
          <FileTabEmpty
            pickProps={
              targetWxid
                ? bindTap<HTMLButtonElement>(
                    { kind: 'action', id: 'chat.selectFile.file.pick' },
                    {
                      params: { id: targetWxid },
                      onTrigger: () =>
                        go('chat.selectFile.file.browser.open', { id: targetWxid }),
                    },
                  )
                : {}
            }
          />
        )}
      </div>

      {/* Bottom bar — only when sheet collapsed */}
      {!isExpanded && (
        <SelectionBar
          collapsed
          count={selectedList.length}
          toggleProps={
            selectedList.length > 0 && targetWxid
              ? bindTap<HTMLButtonElement>('chat.selectFile.selected.expand', { params: { id: targetWxid } })
              : {}
          }
          sendProps={
            selectedList.length > 0 && targetWxid
              ? bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'chat.selectFile.send' },
                  { params: { id: targetWxid }, onTrigger: handleSend },
                )
              : {}
          }
          sendLabel={t.selectFile_send}
          countLabelTpl={t.selectFile_selected_count}
        />
      )}

      </div>
      {/* Expanded selected-files sheet */}
      {isExpanded && (
        <SelectedSheet
          selectedList={selectedList}
          dismissProps={bindBack<HTMLDivElement>({ stopPropagation: true })}
          collapseProps={bindBack<HTMLButtonElement>()}
          removeAction={(choice) =>
            targetWxid
              ? bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'chat.selectFile.selected.remove' },
                  { params: { id: targetWxid }, onTrigger: () => removeChoice(choice.path) },
                )
              : {}
          }
          sendProps={
            selectedList.length > 0 && targetWxid
              ? bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'chat.selectFile.send' },
                  { params: { id: targetWxid }, onTrigger: handleSend },
                )
              : {}
          }
          sendLabel={t.selectFile_send}
          removeLabel={t.selectFile_selected_remove}
          countLabelTpl={t.selectFile_selected_count}
        />
      )}
    </div>
  );
};

// ============================================================================
// SelectionBar — bottom bar shown when sheet is collapsed
// ============================================================================
const SelectionBar: React.FC<{
  collapsed: boolean;
  count: number;
  toggleProps: Record<string, any>;
  sendProps: Record<string, any>;
  sendLabel: string;
  countLabelTpl: string;
}> = ({ count, toggleProps, sendProps, sendLabel, countLabelTpl }) => (
  <div className="shrink-0 bg-app-surface border-t border-app-border px-3 py-2 flex items-center gap-3">
    <button
      type="button"
      className="w-10 h-10 rounded-full bg-(--app-c-search-result-divider) flex items-center justify-center active:opacity-70 disabled:opacity-50"
      disabled={count === 0}
      {...toggleProps}
      aria-label="expand"
    >
      <IcCollapse size={20} className="text-app-text" />
    </button>
    <div className="flex-1 text-center text-[14px] text-(--app-c-tw-text-gray-400)">
      {count > 0 ? countLabelTpl.replace('{n}', String(count)) : ''}
    </div>
    <button
      type="button"
      disabled={count === 0}
      {...sendProps}
      className={`px-6 h-9 rounded-[4px] text-(--app-search-filter-text-size) font-medium ${
        count > 0
          ? 'bg-app-primary text-white active:opacity-80'
          : 'bg-(--app-c-search-result-divider) text-(--app-c-tw-text-gray-400)'
      }`}
    >
      {sendLabel}
    </button>
  </div>
);

// ============================================================================
// SelectedSheet — bottom sheet listing all selected files (URL-driven modal)
// ============================================================================
const SelectedSheet: React.FC<{
  selectedList: FileChoice[];
  dismissProps: Record<string, any>;
  collapseProps: Record<string, any>;
  removeAction: (choice: FileChoice) => Record<string, any>;
  sendProps: Record<string, any>;
  sendLabel: string;
  removeLabel: string;
  countLabelTpl: string;
}> = ({ selectedList, dismissProps, collapseProps, removeAction, sendProps, sendLabel, removeLabel, countLabelTpl }) => (
  <div className="absolute inset-0 z-40 flex flex-col" role="dialog" aria-modal="true">
    {/* Backdrop above sheet — tap to close */}
    <div className="flex-1 bg-black/30" {...dismissProps} />
    {/* Sheet */}
    <div className="bg-app-surface rounded-t-2xl shadow-[0_-2px_12px_rgba(0,0,0,0.08)] max-h-[60%] flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-3 shrink-0">
        <button
          type="button"
          className="w-10 h-10 rounded-full bg-(--app-c-search-result-divider) flex items-center justify-center active:opacity-70"
          {...collapseProps}
          aria-label="collapse"
        >
          <IcExpand size={20} className="text-app-text" />
        </button>
        <div className="flex-1 text-center text-[14px] text-(--app-c-tw-text-gray-400)">
          {countLabelTpl.replace('{n}', String(selectedList.length))}
        </div>
        <button
          type="button"
          {...sendProps}
          className="px-6 h-9 rounded-[4px] text-(--app-search-filter-text-size) font-medium bg-app-primary text-white active:opacity-80"
        >
          {sendLabel}
        </button>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3" data-scroll-container="selectedFiles" data-scroll-direction="vertical">
        {selectedList.map(choice => (
          <div key={choice.path} className="flex items-center gap-3 py-3 border-b border-app-border last:border-b-0">
            <div className="w-12 h-12 rounded bg-(--app-c-search-result-divider) flex items-center justify-center shrink-0">
              {choice.thumbnailPath ? (
                <WechatSmartImage src={choice.thumbnailPath} className="w-full h-full object-cover rounded" />
              ) : (
                <IcFile size={26} className="text-app-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] text-app-text truncate">{truncateName(choice.name, 22)}</div>
              <div className="text-[12px] text-(--app-c-tw-text-gray-400) mt-0.5">{formatSize(choice.size)}</div>
            </div>
            <button
              type="button"
              {...removeAction(choice)}
              className="text-app-primary text-[14px] px-3 py-2 active:opacity-60"
            >
              {removeLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================================================
// TabButton — top tab indicator
// ============================================================================
const TabButton: React.FC<{
  active: boolean;
  label: string;
  tapProps: Record<string, any>;
}> = ({ active, label, tapProps }) => (
  <button
    type="button"
    className="flex flex-col items-center gap-1 px-3 py-1 active:opacity-70"
    {...tapProps}
  >
    <span
      className={`text-[16px] ${active ? 'text-app-text font-medium' : 'text-(--app-c-tw-text-gray-400)'}`}
    >
      {label}
    </span>
    {active && <span className="block w-6 h-[2px] bg-app-text rounded-full" />}
  </button>
);

// ============================================================================
// Tab: 聊天 — 列出所有会话里 type === 'file' 的消息
// ============================================================================
const ChatTabContent: React.FC<{
  chats: ChatSession[];
  isSelectedPath: (path: string) => boolean;
  onToggle: (choice: FileChoice) => void;
  toggleProps:(choice:FileChoice)=>React.HTMLAttributes<HTMLButtonElement>;
}> = ({ chats, isSelectedPath, toggleProps }) => {
  const t = useWechatStrings();

  const fileMessages = useMemo(() => {
    type Entry = { msg: Message; chatName: string };
    const all: Entry[] = [];
    chats.forEach(chat => {
      chat.messages?.forEach(msg => {
        if (msg.type === 'file') {
          all.push({ msg, chatName: chat.user?.name || chat.id });
        }
      });
    });
    all.sort((a, b) => b.msg.timestamp - a.msg.timestamp);
    return all;
  }, [chats]);

  // group by recency bucket label
  const grouped = useMemo(() => {
    const map = new Map<string, typeof fileMessages>();
    fileMessages.forEach(entry => {
      const label = dayBucket(entry.msg.timestamp, t);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(entry);
    });
    return Array.from(map.entries());
  }, [fileMessages, t]);

  if (fileMessages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-(--app-c-tw-text-gray-400) text-[15px]">{t.selectFile_chat_empty}</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      {grouped.map(([label, entries]) => (
        <div key={label} className="mb-3">
          <div className="text-[13px] text-(--app-c-tw-text-gray-400) py-2">{label}</div>
          {entries.map(({ msg, chatName }) => {
            const choice: FileChoice = {
              key: msg.id,
              visibleSource:capturePickerIdentity(msg.content),
              path: msg.content,
              name: msg.fileName || msg.content.split('/').pop() || '文件',
              size: msg.fileSize ?? 0,
              mimeType: msg.mimeType,
              fromLabel: chainLabel(t, chatName, msg.timestamp),
            };
            const sel = isSelectedPath(choice.path);
            return (
              <button
                key={msg.id}
                type="button"
                {...toggleProps(choice)}
                className="w-full flex items-center gap-3 py-3 active:opacity-70"
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {sel ? (
                    <span className="w-5 h-5 rounded-full bg-app-primary flex items-center justify-center">
                      <IcCheck size={14} className="text-white" />
                    </span>
                  ) : (
                    <IcCircle size={20} className="text-(--app-c-tw-text-gray-400)" />
                  )}
                </div>
                <div className="w-12 h-12 rounded bg-app-surface flex items-center justify-center shrink-0">
                  <IcFile size={26} className="text-app-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[15px] text-app-text truncate">{truncateName(choice.name, 22)}</div>
                  <div className="text-[12px] text-(--app-c-tw-text-gray-400) mt-0.5">
                    {formatSize(choice.size)}
                    {choice.fromLabel ? ` · ${choice.fromLabel}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

function chainLabel(t: ReturnType<typeof useWechatStrings>, chatName: string, ts: number): string {
  const dt = TimeService.fromTimestamp(ts);
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return `${t.selectFile_chat_from}${chatName}  ${m}月${d}日`;
}

// ============================================================================
// Tab: 手机相册 — 网格展示 MediaService 中所有图片
// ============================================================================
const AlbumTabContent: React.FC<{
  isSelectedPath: (path: string) => boolean;
  onToggle: (choice: FileChoice) => void;
  toggleProps:(choice:FileChoice)=>React.HTMLAttributes<HTMLButtonElement>;
}> = ({ isSelectedPath, toggleProps }) => {
  const t = useWechatStrings();
  const items = useMemo(() => {
    const list = MediaService.getMediaItems({ albumId: 'all', type: 'image' });
    list.sort((a, b) => b.createdAt - a.createdAt);
    return list.map(item=>({...item,visibleSource:capturePickerIdentity(item.path,item.id)}));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, (MediaItem & {visibleSource:PickerFileIdentity|null})[]>();
    items.forEach(item => {
      const label = dayBucket(item.createdAt, t);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    });
    return Array.from(map.entries());
  }, [items, t]);

  if (items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-(--app-c-tw-text-gray-400) text-[15px]">{t.selectFile_album_empty}</span>
      </div>
    );
  }

  return (
    <div className="px-2 pb-4">
      {grouped.map(([label, entries]) => (
        <div key={label} className="mt-2">
          <div className="text-[13px] text-(--app-c-tw-text-gray-400) px-1 py-2">{label}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {entries.map(item => {
              const choice: FileChoice = {
                key: item.path,
                path: item.path,
                name: item.name,
                size: item.size,
                mimeType: item.mimeType,
                thumbnailPath: item.path,
                visibleSource: item.visibleSource,
              };
              const sel = isSelectedPath(item.path);
              return (
                <button
                  key={item.id}
                  type="button"
                  {...toggleProps(choice)}
                  className="relative aspect-square overflow-hidden rounded bg-(--app-c-search-result-divider) active:opacity-90"
                >
                  <WechatSmartImage key={`${item.id}:${item.visibleSource?.revision}`} src={item.path} className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1">
                    {sel ? (
                      <span className="w-5 h-5 rounded-full bg-app-primary flex items-center justify-center">
                        <IcCheck size={14} className="text-white" />
                      </span>
                    ) : (
                      <IcCircle size={20} className="text-white/90 drop-shadow" />
                    )}
                  </div>
                  <div className="absolute bottom-1 left-1 right-1 text-[10px] text-white/90 truncate drop-shadow">
                    {truncateName(item.name, 16)}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Tab: 收藏 — 占位空态（无实际数据）
// ============================================================================
const FavoritesTabEmpty: React.FC = () => {
  const t = useWechatStrings();
  return (
    <div className="h-full flex items-center justify-center">
      <span className="text-(--app-c-tw-text-gray-400) text-[15px]">{t.selectFile_favorites_empty}</span>
    </div>
  );
};

// ============================================================================
// Tab: 手机文件 — 始终空态 + 选取按钮（已选文件汇总在底部 sheet 里）
// ============================================================================
const FileTabEmpty: React.FC<{
  pickProps: Record<string, any>;
}> = ({ pickProps }) => {
  const t = useWechatStrings();
  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <span className="text-[15px] text-(--app-c-tw-text-gray-400)">{t.selectFile_file_empty_hint}</span>
      <button
        type="button"
        {...pickProps}
        className="mt-6 px-12 py-3 rounded-[8px] bg-(--app-c-search-result-divider) text-app-text text-[16px] active:opacity-70"
      >
        {t.selectFile_file_pick}
      </button>
    </div>
  );
};

// ============================================================================
// Sub-view: inline file browser (内置文件选择器)
// ============================================================================
const FileBrowserView: React.FC<{
  dir: string;
  navigation: ReturnType<typeof usePickerSession>;
  onPickFile: (node: FSNode,visible:PickerFileIdentity|null) => void;
}> = ({ dir, onPickFile, navigation: browserSession }) => {
  const t = useWechatStrings();
  const { id: targetWxid } = useParams<{ id: string }>();
  const {go,bindBack}=browserSession;

  const nodes = useMemo(() => FileSystem.listDirectory(dir).map(node=>({...node,visibleSource:capturePickerIdentity(node.path,node.id)})), [dir]);
  const parent = useMemo(() => {
    if (dir === FILE_BROWSER_ROOT || dir === '/') return null;
    const idx = dir.lastIndexOf('/');
    if (idx <= 0) return '/';
    return dir.slice(0, idx) || '/';
  }, [dir]);

  return (
    <div className="flex flex-col h-full bg-app-bg" data-status-bar-foreground="dark">
      {browserSession.error&&<p role="alert" className="px-4 pt-10 text-sm text-red-600">{t.chat_picker_source_changed}</p>}
      {/* Top bar */}
      <div className="pt-10 flex items-center px-2 h-[88px] shrink-0 bg-app-bg border-b border-app-border">
        <button
          type="button"
          className="w-10 h-10 flex items-center justify-center active:opacity-60"
          {...bindBack<HTMLButtonElement>()}
          aria-label="back"
        >
          <IcNavBack size={26} className="text-app-text" />
        </button>
        <div className="flex-1 text-center text-[17px] font-medium text-app-text truncate px-2">
          {dir === FILE_BROWSER_ROOT ? t.selectFile_browser_title : dir.split('/').pop()}
        </div>
        <div className="w-10 h-10" />
      </div>

      {/* Path */}
      <div className="px-4 py-2 text-[12px] text-(--app-c-tw-text-gray-400) shrink-0 bg-app-bg truncate">
        {dir}
      </div>

      <div
        className="flex-1 overflow-y-auto bg-app-bg"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {parent != null && (
          <button
            type="button"
            {...browserSession.bindTap('chat.selectFile.file.browser.navigate',{params:{id:targetWxid!,dir:parent},onTrigger:()=>go('chat.selectFile.file.browser.navigate',{id:targetWxid!,tab:'file',dir:parent})})}
            className="w-full flex items-center gap-3 px-4 py-3 active:opacity-70 border-b border-app-border"
          >
            <IcFolder size={26} className="text-(--app-c-tw-text-gray-400)" />
            <span className="text-[15px] text-app-text">..</span>
          </button>
        )}
        {nodes.map(node => (
          <button
            key={node.id}
            type="button"
            data-wechat-file-path={node.path}
            {...(node.type==='directory'
              ? browserSession.bindTap<HTMLButtonElement>('chat.selectFile.file.browser.navigate',{params:{id:targetWxid!,tab:'file',dir:node.path},onTrigger:()=>{if(FileSystem.getNode(node.path)?.id===node.id)go('chat.selectFile.file.browser.navigate',{id:targetWxid!,tab:'file',dir:node.path});else browserSession.fail();}})
              : browserSession.bindTap<HTMLButtonElement>({kind:'action',id:'chat.selectFile.file.item.pick'},{params:{path:node.path},onTrigger:()=>onPickFile(node,node.visibleSource)}))}
            className="w-full flex items-center gap-3 px-4 py-3 active:opacity-70 border-b border-app-border"
          >
            {node.type === 'directory' ? (
              <IcFolder size={26} className="text-app-primary" />
            ) : (
              <IcFile size={26} className="text-(--app-c-tw-text-gray-400)" />
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[15px] text-app-text truncate">{node.name}</div>
              {node.type === 'file' && (
                <div className="text-[12px] text-(--app-c-tw-text-gray-400) mt-0.5">
                  {formatSize(node.size)}
                </div>
              )}
            </div>
          </button>
        ))}
        {nodes.length === 0 && (
          <div className="px-4 py-10 text-center text-(--app-c-tw-text-gray-400) text-[14px]">
            {t.selectFile_album_empty}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectFilePage;
