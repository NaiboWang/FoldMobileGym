import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { IcAudioLines, IcMore, IcNavBack, IcCheck, IcFile, IcFolder, IcPhone, IcSearch, IcSettings } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import * as TimeService from '../../../os/TimeService';
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore, selectVisibleNotes } from '../state';
import { BottomTabBar } from '../components/BottomTabBar';
import {
  IcDataItemAudio,
  IcDataItemClock,
  IcDataItemMindOutline,
  IcDataItemStick,
  IcNoteLock,
  IcFab,
} from '../res/icons';
import { ActionSheet } from '../components/ActionSheet';
import { Toast } from '@/os/components/Toast';
import { colors } from '../res/colors';
import { dimens } from '../res/dimens';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import type { Note } from '../types';
import { useNoteInteractionOwner } from '../hooks/useNoteInteractionOwner';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { getFolderDisplayName } from '../utils';
import { groupReferenceNotes, noteLibraryDate, noteLibraryGroupLabel, noteLibraryGreeting } from '../referenceLibrary';
import { useLocale } from '../../../os/locale';
import { useSystemEvent } from '../../../os/hooks/useSystemEvent';
import { ACTION_TIME_SET, ACTION_TIME_TICK } from '../../../os/BroadcastBus';
import { useReceiveVisits } from '../receiveVisits';

const NOTE_LONG_PRESS_MS = 520;
const NOTE_LONG_PRESS_MOVE_CANCEL_PX = 12;

function formatListTime(timestamp: number, s: typeof strings) {
  const d = TimeService.fromTimestamp(timestamp);
  const now = TimeService.getDate();

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  if (y !== now.getFullYear()) return `${y}${s.date_suffix_year}${m}${s.date_suffix_month}${day}${s.date_suffix_day}`;

  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${m}${s.date_suffix_month}${day}${s.date_suffix_day} ${hh}:${mm}`;
}

function snippet(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

const NoteCard: React.FC<{
  note: Note;
  selectionMode: boolean;
  selected: boolean;
  compactDate?: string;
  onOpen: () => void;
  onToggleSelected: () => void;
  onLongPress: () => void;
}> = ({ note, selectionMode, selected, compactDate, onOpen, onToggleSelected, onLongPress }) => {
  const s = useAppStrings(strings, stringsEn);
  const title = note.title.trim() || s.untitled;
  const content = snippet(note.content);
  const isCall = note.folderId === 'call';

  const longPressTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  useEffect(() => {
    return () => clearLongPress();

  }, []);

  return (
    <div
      className={[
        'relative inline-block w-full bg-app-surface rounded-[16px] px-5 py-4 mb-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] break-inside-avoid',
        compactDate !== undefined ? 'notes-home-list-card' : '',
        compactDate !== undefined && selectionMode ? 'is-selecting' : '',
        selected ? 'outline outline-2' : '',
      ].join(' ')}
      style={selected ? { outlineColor: colors.theme_main } : undefined}
    >
      {selectionMode ? (
        <div className="absolute right-2 top-2 z-10">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
            aria-label={selected ? s.action_cancel_select : s.action_select}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelected();
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                border: `1px solid ${selected ? colors.theme_main : 'rgba(0,0,0,0.18)'}`,
                backgroundColor: selected ? colors.theme_main : '#fff',
              }}
            >
              {selected ? <IcCheck size={14} className="text-white" /> : null}
            </div>
          </button>
        </div>
      ) : null}

      <button
        onClick={(e) => {
          if (didLongPressRef.current) {
            didLongPressRef.current = false;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (selectionMode) onToggleSelected();
          else onOpen();
        }}
        className="w-full text-left active:scale-[0.99] transition-transform"
        onContextMenu={(e) => {
          // Allow OS/browser context menu elsewhere; this is only for right-click usage.
          e.preventDefault();
        }}
        onPointerDown={(e) => {
          if (selectionMode) return;
          // Only primary mouse button triggers long press
          // (Touch/pen have button=0 typically)
          if (e.pointerType === 'mouse' && e.button !== 0) return;

          didLongPressRef.current = false;
          startPosRef.current = { x: e.clientX, y: e.clientY };
          clearLongPress();
          longPressTimerRef.current = window.setTimeout(() => {
            didLongPressRef.current = true;
            onLongPress();
          }, NOTE_LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          if (!startPosRef.current || !longPressTimerRef.current) return;
          const dx = e.clientX - startPosRef.current.x;
          const dy = e.clientY - startPosRef.current.y;
          if (Math.hypot(dx, dy) > NOTE_LONG_PRESS_MOVE_CANCEL_PX) {
            clearLongPress();
          }
        }}
        onPointerUp={() => {
          startPosRef.current = null;
          clearLongPress();
        }}
        onPointerCancel={() => {
          startPosRef.current = null;
          clearLongPress();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={compactDate !== undefined ? 'notes-home-list-title' : 'text-[18px] font-semibold text-black truncate'}>{title}</div>
            {compactDate === undefined && <div className="mt-2 text-[14px] truncate" style={{ color: 'rgba(0,0,0,0.35)' }}>
              {content || s.no_content}
            </div>}

            <div className={compactDate !== undefined ? 'notes-home-list-meta' : 'mt-4 flex items-center gap-2 text-[12px]'} style={{ color: colors.text_secondary }}>
              {compactDate !== undefined ? <div className="notes-home-list-summary"><span>{compactDate}</span><span>{content || s.no_content}</span></div> : <div className="flex-1 truncate">{formatListTime(note.updatedAt, s)}</div>}
              {note.pinned ? <IcDataItemStick size={14} /> : null}
              {note.hasVoice ? <IcDataItemAudio size={14} /> : null}
              {note.hasChecklist ? <IcDataItemMindOutline size={14} /> : null}
              {typeof note.alarmAt === 'number' ? <IcDataItemClock size={14} /> : null}
              {note.locked ? <IcNoteLock size={14} color={colors.text_secondary} /> : null}
            </div>
          </div>

          {isCall ? (
            <div className="shrink-0 text-[#d2d2d2] mt-1">
              <IcPhone size={16} />
            </div>
          ) : null}
        </div>
      </button>
    </div>
  );
};

export const NotesListPage: React.FC = () => {
  const { go, back, bindTap } = useNotesGestures();
  const [searchParams, setSearchParams] = useSearchParams();
  const activityId = useActivityId();
  const receiveVisits = useReceiveVisits();
  const createOwner = useNoteInteractionOwner('new', () => null);
  const notes = useNotesStore(selectVisibleNotes);
  const { folders, selectedFolderId, setSelectedFolderId, settings, updateNote, deleteNote, hideNote } =
    useNotesStore(
      useShallow(s => ({
        folders: s.folders,
        selectedFolderId: s.selectedFolderId,
        setSelectedFolderId: s.setSelectedFolderId,
        settings: s.settings,
        updateNote: s.updateNote,
        deleteNote: s.deleteNote,
        hideNote: s.hideNote,
      }))
    );
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const [now, setNow] = useState(TimeService.now);
  const refreshTime = () => setNow(TimeService.now());
  useSystemEvent(ACTION_TIME_SET, refreshTime);
  useSystemEvent(ACTION_TIME_TICK, refreshTime);
  const [query, setQuery] = useState('');
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [moveNote, setMoveNote] = useState<Note | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(() => new Set());
  const [batchMoveIds, setBatchMoveIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [showVoicePromo, setShowVoicePromo] = useState(true);
  const homeMenuOpen = searchParams.get('sheet') === 'menu';
  const receiveOpen = searchParams.get('sheet') === 'receive';
  const addNote = useNotesStore(state => state.addNote);
  const receivedText = useMemo(() => {
    const payload = activityId ? window.__OS__?.getIntentPayload?.(activityId) : null;
    if (payload?.action !== 'ACTION_SEND' || payload.type !== 'text/plain') return '';
    const data = payload.data as { text?: unknown; body?: unknown } | undefined;
    const value = typeof data?.text === 'string' ? data.text : typeof data?.body === 'string' ? data.body : '';
    return value.trim() ? value : '';
  }, [activityId]);
  useEffect(() => {
    if (!activityId || !receivedText || receiveVisits.has(activityId)) return;
    receiveVisits.add(activityId);
    if (!receiveOpen) go('notes.list.receive.open');
  }, [activityId, go, receiveOpen, receiveVisits, receivedText]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(n => {
      const folderOk = selectedFolderId === 'all' || n.folderId === selectedFolderId;
      if (!folderOk) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    });
  }, [notes, query, selectedFolderId]);
  const groups = useMemo(() => groupReferenceNotes(filtered, now), [filtered, now]);
  const referenceSummary = useMemo(() => {
    const greeting = noteLibraryGreeting(now, s);
    const summary = filtered.length === 1 ? s.library_summary_one : s.library_summary_many;
    return s.library_summary_prefix.replace('{greeting}', greeting) + filtered.length + summary;
  }, [filtered.length, now, s]);
  const receiveSaving = useRef(false);
  const saveReceivedText = () => {
    const os = window.__OS__?.getState();
    const active = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
    if (!receivedText || !receiveOpen || receiveSaving.current || os?.isLauncherVisible || os?.isRecentsVisible || active?.activityId !== activityId) return;
    receiveSaving.current = true;
    const title = receivedText.split(/\r?\n/, 1)[0].trim().slice(0, 80) || s.received_text_untitled;
    const note = addNote({ title, content: receivedText });
    go('notes.list.receive.save', { id: note.id });
  };

  const noteById = useMemo(() => new Map(notes.map(n => [n.id, n] as const)), [notes]);
  const selectedNotes = useMemo(() => {
    const out: Note[] = [];
    selectedNoteIds.forEach((id) => {
      const n = noteById.get(id);
      if (n) out.push(n);
    });
    return out;
  }, [noteById, selectedNoteIds]);

  const selectedCount = selectedNoteIds.size;
  const allPinned = selectedNotes.length > 0 && selectedNotes.every(n => !!n.pinned);
  const allFilteredSelected = filtered.length > 0 && filtered.every(n => selectedNoteIds.has(n.id));

  useEffect(() => {
    if (selectionMode && selectedNoteIds.size === 0) setSelectionMode(false);
  }, [selectionMode, selectedNoteIds]);

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedNoteIds(new Set());
    setBatchMoveIds(null);
  };

  const startSelection = (noteId: string) => {
    setSelectionMode(true);
    setSelectedNoteIds(new Set([noteId]));
    setActiveNote(null);
    setMoveNote(null);
  };

  const toggleSelected = (noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
  };

  const handleBatchStick = () => {
    if (!selectedNotes.length) return;
    const nextPinned = !allPinned;
    selectedNotes.forEach((n) => updateNote(n.id, { pinned: nextPinned }));
    showToast(nextPinned ? s.toast_pinned : s.toast_unpinned);
    cancelSelection();
  };

  const handleBatchHide = () => {
    if (!selectedNotes.length) return;
    selectedNotes.forEach((n) => hideNote(n.id));
    showToast(s.toast_set_private);
    cancelSelection();
  };

  const handleBatchDelete = () => {
    if (!selectedNotes.length) return;
    selectedNotes.forEach((n) => deleteNote(n.id));
    showToast(s.toast_moved_to_trash);
    cancelSelection();
  };

  const topPad = statusBarHeight + 18;
  const tabBarHeight = 64 + bottomGestureHeight;
  const fabBottom = tabBarHeight + dimens.fab_margin;

  return (
    <div
      className="h-full w-full relative flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.page_bg }}
    >
      {/* Header */}
      <div className="shrink-0" style={{ paddingTop: topPad, backgroundColor: colors.page_bg }}>
        <div className="px-5">
          {selectionMode ? (
            <div className="flex items-center justify-between">
              <button
                className="w-10 h-10 -ml-2 flex items-center justify-center active:opacity-70"
                onClick={cancelSelection}
                aria-label={s.action_cancel}
              >
                <IcNavBack size={24} className="text-black" />
              </button>
              <div className="text-[16px] font-medium text-black">{s.selected_count_prefix}{selectedCount}{s.selected_count_suffix}</div>
              <button
                className="h-10 px-2 -mr-2 text-[14px] font-medium active:opacity-70"
                style={{ color: colors.theme_main }}
                onClick={() => {
                  if (allFilteredSelected) setSelectedNoteIds(new Set());
                  else {
                    setSelectionMode(true);
                    setSelectedNoteIds(new Set(filtered.map(n => n.id)));
                  }
                }}
              >
                {allFilteredSelected ? s.action_deselect_all : s.action_select_all}
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end items-center gap-3">
                {settings.notesViewMode === 'list' ? (
                  <button
                    className="w-10 h-10 flex items-center justify-center active:opacity-70"
                    {...bindTap('notes.list.menu.open')}
                    aria-label={s.action_more}
                  >
                    <IcMore size={22} className="text-black" />
                  </button>
                ) : null}
                <button
                  className="w-10 h-10 flex items-center justify-center active:opacity-70"
                  onClick={() => {
                    go('folders.open');
                  }}
                  aria-label={s.folders}
                >
                  <IcFolder size={22} className="text-black" />
                </button>
                <button
                  hidden={settings.notesViewMode === 'list'}
                  className="w-10 h-10 flex items-center justify-center active:opacity-70"
                  onClick={() => {
                    go('settings.open');
                  }}
                  aria-label={s.settings}
                >
                  <IcSettings size={22} className="text-black" />
                </button>
              </div>
              <div className={settings.notesViewMode === 'list' ? 'notes-reference-home-title' : 'mt-3 text-[36px] leading-none font-medium text-black tracking-tight'}>
                {settings.notesViewMode === 'list' ? s.library_all_notes : s.notes}
              </div>
              {settings.notesViewMode === 'list' ? <div className="notes-reference-home-summary">{referenceSummary}</div> : null}
              {settings.notesViewMode === 'list' && selectedFolderId === 'all' && !query.trim() && showVoicePromo ? (
                <div className="notes-voice-promo" data-notes-voice-promo>
                  <button type="button" className="notes-voice-promo-dismiss" aria-label={s.voice_promo_dismiss} onClick={() => setShowVoicePromo(false)}>×</button>
                  <div className="notes-voice-promo-copy">
                    <div className="notes-voice-promo-title">{s.voice_promo_title}</div>
                    <div className="notes-voice-promo-subtitle">{s.voice_promo_subtitle}</div>
                    <button type="button" className="notes-voice-promo-cta" onClick={() => go('notes.list.create.open')}>
                      {s.voice_promo_cta}
                    </button>
                  </div>
                  <IcAudioLines size={42} className="notes-voice-promo-icon" aria-hidden="true" />
                </div>
              ) : null}

              <div className="mt-4 relative">
                <IcSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bdbdbd]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={s.search_placeholder}
                  className="w-full h-10 bg-[#ededed] rounded-[14px] pl-11 pr-4 text-[15px] text-black placeholder:text-[#bdbdbd] outline-none"
                />
              </div>

              <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {folders.map(f => {
                  const active = f.id === selectedFolderId;
                  return (
                <button
                  hidden={settings.notesViewMode === 'list'}
                      key={f.id}
                      onClick={() => setSelectedFolderId(f.id)}
                      className={[
                        'shrink-0 px-4 h-9 rounded-[14px] text-[14px] transition-colors',
                        active ? 'bg-[#ededed] text-black font-medium' : 'bg-app-surface text-app-text-muted',
                      ].join(' ')}
                    >
                      {getFolderDisplayName(f, s)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: tabBarHeight + 28 }}>
        {filtered.length ? (
          settings.notesViewMode === 'grid' ? (
            <div className="pt-2 columns-2 gap-3">
              {filtered.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  selectionMode={selectionMode}
                  selected={selectedNoteIds.has(note.id)}
                  onOpen={() => go('note.open', { id: note.id })}
                  onToggleSelected={() => toggleSelected(note.id)}
                  onLongPress={() => startSelection(note.id)}
                />
              ))}
            </div>
          ) : (
            <div className="pt-2">
              {groups.map(group => (
                <section key={group.key}>
                  <h2 className="px-1 pt-3 pb-2 text-[15px] font-medium text-app-text">
                    {noteLibraryGroupLabel(group, now, locale, s)}
                  </h2>
                  {group.notes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      selectionMode={selectionMode}
                      selected={selectedNoteIds.has(note.id)}
                      compactDate={noteLibraryDate(note.updatedAt, now, locale)}
                      onOpen={() => go('note.open', { id: note.id })}
                      onToggleSelected={() => toggleSelected(note.id)}
                      onLongPress={() => startSelection(note.id)}
                    />
                  ))}
                </section>
              ))}
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[#bdbdbd] pt-10">
            <IcFile size={52} strokeWidth={1.4} className="mb-3 opacity-60" />
            <div className="text-[14px]">{s.empty_notes}</div>
          </div>
        )}
      </div>

      {/* Floating action button */}
      {!selectionMode ? (
        <button
          data-keep-keyboard="true" {...bindTap('notes.list.create.open', { onTrigger: () => { if (createOwner.active()) { window.__OS__?.keyboard.hide(); go('notes.list.create.open'); } } })}
          className="absolute rounded-full text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
          style={{
            bottom: fabBottom,
            right: dimens.fab_margin,
            width: dimens.fab_size,
            height: dimens.fab_size,
            backgroundColor: colors.theme_main,
          }}
          aria-label={s.action_new_note}
        >
          <IcFab size={30} />
        </button>
      ) : null}

      {selectionMode ? (
        <div className="absolute left-0 right-0 bottom-0 z-40 bg-white/90 backdrop-blur-xl border-t border-black/5">
          <div className="flex items-center justify-around h-[64px]" style={{ paddingBottom: bottomGestureHeight }}>
            <button
              disabled={!selectedCount}
              onClick={handleBatchStick}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: colors.text_secondary_strong }}
            >
              {allPinned ? s.action_unpin : s.action_pin}
            </button>
            <button
              disabled={!selectedCount}
              onClick={() => setBatchMoveIds(Array.from(selectedNoteIds))}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: colors.text_secondary_strong }}
            >
              {s.action_move_to}
            </button>
            <button
              disabled={!selectedCount}
              onClick={handleBatchHide}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: colors.text_secondary_strong }}
            >
              {s.action_set_private}
            </button>
            <button
              disabled={!selectedCount}
              onClick={handleBatchDelete}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: '#ff3b30' }}
            >
              {s.action_delete}
            </button>
          </div>
        </div>
      ) : (
        <BottomTabBar active="notes" />
      )}

      {!selectionMode ? (
        receiveOpen ? (
          <div className="fixed inset-0 z-[90] flex items-end bg-black/35" role="dialog" aria-modal="true" aria-label={s.received_text_title}>
            <button type="button" className="absolute inset-0" aria-label={s.action_close} onClick={() => back()} />
            <section className="relative z-10 w-full rounded-t-[28px] bg-app-surface px-5 pt-5 pb-8 shadow-2xl">
              <h2 className="text-[20px] font-semibold text-app-text">{s.received_text_title}</h2>
              <p className="mt-2 text-[13px] text-app-text-muted">{s.received_text_hint}</p>
              <div className="mt-4 max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-black/5 p-4 text-[14px] text-app-text">{receivedText || s.library_no_text}</div>
              <div className="mt-5 flex gap-3">
                <button type="button" className="flex-1 rounded-2xl bg-black/5 py-3 text-app-text" onClick={() => back()}>{s.received_text_cancel}</button>
                <button type="button" disabled={!receivedText} className="flex-1 rounded-2xl bg-app-primary py-3 text-white disabled:opacity-40" onClick={saveReceivedText}>{s.received_text_save}</button>
              </div>
            </section>
          </div>
        ) : null
      ) : null}

      {!selectionMode ? (
        <ActionSheet
          visible={homeMenuOpen}
          title={s.notes}
          onClose={back}
          items={[
            { key: 'folders', label: s.folders, onClick: () => go('notes.list.menu.folders.open') },
            { key: 'settings', label: s.settings, onClick: () => go('notes.list.menu.settings.open') },
          ]}
        />
      ) : null}

      {!selectionMode ? (
        <ActionSheet
          visible={!!activeNote}
          title={s.notes}
          cancelLabel={s.action_cancel}
          items={
            activeNote
              ? [
                  {
                    key: 'pin',
                    label: activeNote.pinned ? s.action_unpin : s.action_pin,
                    onClick: () => {
                      updateNote(activeNote.id, { pinned: !activeNote.pinned });
                      setActiveNote(null);
                      showToast(activeNote.pinned ? s.toast_unpinned : s.toast_pinned);
                    },
                  },
                  {
                    key: 'move',
                    label: s.action_move_to,
                    onClick: () => {
                      setMoveNote(activeNote);
                      setActiveNote(null);
                    },
                  },
                  {
                    key: 'hide',
                    label: s.action_set_private,
                    onClick: () => {
                      hideNote(activeNote.id);
                      setActiveNote(null);
                      showToast(s.toast_set_private);
                    },
                  },
                  {
                    key: 'delete',
                    label: s.action_delete,
                    danger: true,
                    onClick: () => {
                      deleteNote(activeNote.id);
                      setActiveNote(null);
                      showToast(s.toast_moved_to_trash);
                    },
                  },
                ]
              : []
          }
          onClose={() => setActiveNote(null)}
        />
      ) : null}

      {/* Move to folder sheet */}
      {!selectionMode && moveNote ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/35"
            onClick={() => setMoveNote(null)}
            aria-label={s.action_close}
          />
          <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] overflow-hidden">
            <div className="px-5 py-4 text-[14px] font-medium text-black">{s.action_move_to}</div>
            <div className="px-3 pb-3">
              {folders
                .filter(f => f.id !== 'all')
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      updateNote(moveNote.id, { folderId: f.id });
                      setMoveNote(null);
                      setToast({ message: s.toast_moved_to_prefix + getFolderDisplayName(f, s) + s.toast_moved_to_suffix, visible: true });
                      window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
                    }}
                    className="w-full flex items-center justify-between px-3 h-12 rounded-[14px] active:bg-black/5"
                  >
                    <div className="text-[15px] text-black">{getFolderDisplayName(f, s)}</div>
                    <div className="w-5 h-5" />
                  </button>
                ))}
              <div className="h-2" />
              <button
                className="w-full h-12 rounded-[14px] bg-[#f3f3f3] text-[15px] active:opacity-80"
                style={{ color: colors.text_secondary_strong }}
                onClick={() => setMoveNote(null)}
              >
                {s.action_cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Batch move sheet */}
      {batchMoveIds ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/35"
            onClick={() => setBatchMoveIds(null)}
            aria-label={s.action_close}
          />
          <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] overflow-hidden">
            <div className="px-5 py-4 text-[14px] font-medium text-black">{s.action_move_to}</div>
            <div className="px-3 pb-3">
              {folders
                .filter(f => f.id !== 'all')
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      batchMoveIds.forEach((id) => updateNote(id, { folderId: f.id }));
                      setBatchMoveIds(null);
                      showToast(s.toast_moved_to_prefix + getFolderDisplayName(f, s) + s.toast_moved_to_suffix);
                      cancelSelection();
                    }}
                    className="w-full flex items-center justify-between px-3 h-12 rounded-[14px] active:bg-black/5"
                  >
                    <div className="text-[15px] text-black">{getFolderDisplayName(f, s)}</div>
                    <div className="w-5 h-5" />
                  </button>
                ))}
              <div className="h-2" />
              <button
                className="w-full h-12 rounded-[14px] bg-[#f3f3f3] text-[15px] active:opacity-80"
                style={{ color: colors.text_secondary_strong }}
                onClick={() => setBatchMoveIds(null)}
              >
                {s.action_cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default NotesListPage;

