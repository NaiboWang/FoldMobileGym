import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { adoptedNoteEditorUrl, isFullNoteEditor } from '../editorView';
import {
  IcNavBack,
  IcExpand,
  IcCollapse,
  IcCheck,
  IcSearch,
  IcMoreVert,
  IcRedo,
  IcShare,
  IcUndo,
  IcAiNotes,
} from '../res/icons';
import { useKeyboard } from '../../../os/keyboard/useKeyboard';
import { KeyboardService } from '../../../os/keyboard/KeyboardService';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import * as TimeService from '../../../os/TimeService';
import { NOTES_CONFIG } from '../data';
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore } from '../state';
import { Toast } from '@/os/components/Toast';
import { EditorSheet } from '../components/EditorSheet';
import { getNoteEditorSheet } from '../editorOverlay';
import { DateTimeDialog } from '../components/DateTimeDialog';
import { IcFolderMenuArrow, IcNoteLock } from '../res/icons';
import { colors } from '../res/colors';
import { dimens } from '../res/dimens';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { getFolderDisplayName, isNoteTrashed } from '../utils';
import { persistEditorText, editorFields, editorPatch, sameEditorFields, type EditorTextDraft } from '../editorPersistence';
import { appendNoteImage, sameNoteImages, noteImageFields, type NoteImage } from '../noteImages';
import { useNoteImagePicker } from '../hooks/useNoteImagePicker';
import { NoteImageBlock } from '../components/NoteImageBlock';
import { resolveNoteImageNode } from '../utils/imageSource';
import { useNoteTextHistory } from '../hooks/useNoteTextHistory';
import type { EditorText } from '../textHistory';
import { NoteChecklist } from '../components/NoteChecklist';
import { authoredChecklist, checklistFields, changeChecklistText, type NoteChecklistFields } from '../noteChecklist';
import { useNoteInteractionOwner } from '../hooks/useNoteInteractionOwner';
import { useNoteEditorVisibility } from '../hooks/useNoteEditorVisibility';
import { noteTextShareIntent } from '../noteTextShare';
import { useNoteTextShare } from '../hooks/useNoteTextShare';
import { NoteTextSearch } from '../components/NoteTextSearch';
import { NoteAiPanel } from '../components/NoteAiPanel';
import { NoteFormattingToolbar } from '../components/NoteFormattingToolbar';

// 智能字数统计：中文按字符，英文按单词
function countWords(text: string): number {
  if (!text.trim()) return 0;
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const englishText = text.replace(/[\u4e00-\u9fa5]/g, ' ').trim();
  const englishWords = englishText ? englishText.split(/\s+/).filter(w => w.length > 0) : [];
  return chineseChars.length + englishWords.length;
}

function formatHeaderTime(timestamp: number, s: typeof strings) {
  const d = TimeService.fromTimestamp(timestamp);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = d.getHours(); // 真机展示不补零
  const mi = d.getMinutes().toString().padStart(2, '0');
  return `${mm}${s.date_suffix_month}${dd}${s.date_suffix_day} ${hh}:${mi}`;
}

export const NoteEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const sheet = getNoteEditorSheet(location.pathname, location.search);
  const focused = isFullNoteEditor(location.pathname, location.search);
  const { back, bindBack, bindTap, go, navigateTo } = useNotesGestures();
  const {
    notes,
    folders,
    settings,
    addNote,
    updateNote,
    deleteNote,
    restoreNote,
    deleteNoteForever,
    hideNote,
    unhideNote,
  } = useNotesStore(
    useShallow(s => ({
      notes: s.notes,
      folders: s.folders,
      settings: s.settings,
      addNote: s.addNote,
      updateNote: s.updateNote,
      deleteNote: s.deleteNote,
      restoreNote: s.restoreNote,
      deleteNoteForever: s.deleteNoteForever,
      hideNote: s.hideNote,
      unhideNote: s.unhideNote,
    }))
  );
  const s = useAppStrings(strings, stringsEn);
  const { visible: keyboardVisible } = useKeyboard();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  useNoteEditorVisibility(editorScrollRef, id);

  const isNew = id === 'new';
  const existing = useMemo(
    () => (isNew || !id ? undefined : notes.find(n => n.id === id)),
    [id, isNew, notes],
  );

  const [title, setTitle] = useState(existing?.title ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [images, setImages] = useState<NoteImage[] | undefined>(existing?.images);
  const [folderId, setFolderId] = useState<string>(existing?.folderId ?? 'unfiled');
  const [checklistDraft,setChecklistDraft]=useState<NoteChecklistFields>(()=>checklistFields(existing??{}));
  const folderPickerOpen = sheet === 'folder';
  const menuOpen = sheet === 'menu';
  const reminderOpen = sheet === 'reminder';

  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const isFirstLoadRef = useRef(true);
  const loadedContentRef = useRef<EditorText & { folderId: string }>({ title: existing?.title ?? '', content: existing?.content ?? '',
    folderId: existing?.folderId ?? 'unfiled', ...noteImageFields(existing?.images), ...checklistFields(existing??{}) });

  const isLocked = !!existing?.locked;
  const isTrashed = isNoteTrashed(existing);
  const isPrivate = !!existing?.isPrivate;
  const savedNewRef = useRef(false);
  const savedNewIdRef = useRef<string | null>(null);
  const initializedRouteRef = useRef<string | undefined>(isNew || existing ? id : undefined);
  const latestDraftRef = useRef<EditorTextDraft>({ title, content, folderId, ...noteImageFields(images), ...checklistFields(checklistDraft), isNew, isTrashed, existingId: existing?.id });
  const persistOnExitRef = useRef<() => void>(() => {});
  latestDraftRef.current = { title, content, folderId, ...noteImageFields(images), ...checklistFields(checklistDraft), isNew, isTrashed, existingId: existing?.id };
  const noteOwner=useNoteInteractionOwner(id,()=>savedNewIdRef.current);
  const liveEditorSource=()=>{
    const sourceId=isNew?savedNewIdRef.current:id;
    const matches=useNotesStore.getState().notes.filter(note=>note.id===sourceId);
    return matches.length===1?matches[0]:undefined;
  };
  const sourceStillCurrent=()=>{
    if(isNew&&!savedNewIdRef.current)return true;
    const live=liveEditorSource();return !!live&&!isNoteTrashed(live)&&sameEditorFields(live,loadedContentRef.current);
  };
  const canInteract=()=>noteOwner.active()&&!sheet&&!isTrashed&&sourceStillCurrent();

  const publishFields = (fields: Partial<Pick<typeof latestDraftRef.current, 'title' | 'content' | 'folderId' | 'images' | 'hasChecklist' | 'checklist'>>) => {
    const draft = { ...latestDraftRef.current, ...fields };
    if (draft.isTrashed || (!draft.isNew && !draft.existingId) || !sourceStillCurrent()) return;
    const before=loadedContentRef.current;
    latestDraftRef.current = draft;
    setTitle(draft.title); setContent(draft.content); setFolderId(draft.folderId); setImages(draft.images);setChecklistDraft(checklistFields(draft));
    const noteId = noteOwner.write(()=>persistEditorText(draft, savedNewIdRef.current, addNote, (noteId,next)=>{
      const patch=editorPatch(before,next);if(Object.keys(patch).length)updateNote(noteId,patch);
    }));
    if (!noteId) return;
    loadedContentRef.current = editorFields(draft);
    if (draft.isNew && savedNewIdRef.current === null) {
      editHistory.adopt(noteId);
      savedNewIdRef.current = noteId;
      savedNewRef.current = true;
      navigateTo(adoptedNoteEditorUrl(noteId, location.pathname, location.search), { replace: true });
    }
  };
  const editHistory = useNoteTextHistory({
    initial: { title: existing?.title ?? '', content: existing?.content ?? '', ...noteImageFields(existing?.images), ...checklistFields(existing??{}) }, routeId: id, readOnly: isTrashed || (!isNew && !existing), isActive:canInteract,
    titleRef: titleInputRef, contentRef: contentTextareaRef, commit: (text: EditorText) => publishFields({ title: text.title, content: text.content,
      ...(text.images !== undefined || latestDraftRef.current.images !== undefined ? { images: text.images ?? [] } : {}),
      ...(text.hasChecklist!==undefined||latestDraftRef.current.hasChecklist!==undefined?{hasChecklist:!!text.hasChecklist}:{}),
      ...(text.checklist!==undefined||latestDraftRef.current.checklist!==undefined?{checklist:text.checklist??[]}:{}),
    }),
  });

  const imagePicker = useNoteImagePicker({ routeId: id, note: existing, blocked: !!sheet || isTrashed || (!isNew && !existing),
    onPick: source => editHistory.images(appendNoteImage(latestDraftRef.current.images, source,
      `image-${TimeService.now()}-${Math.random().toString(36).slice(2,8)}`), 'insertImage'),
  });
  const openImage = (image: NoteImage) => {
    if (sheet || !existing || useNotesStore.getState().notes.find(note => note.id === id) !== existing) return;
    const node = resolveNoteImageNode(image.source);
    if (!node) { showToast(s.image_unavailable); return; }
    window.__OS__?.keyboard.hide();
    window.__OS__?.startActivity({ action: 'ACTION_VIEW', type: node.mimeType ?? 'image/*', data: { stream: node.path } });
  };
  const removeImage = (imageId: string) => {
    if (sheet || imagePicker.busy || isTrashed || !existing || useNotesStore.getState().notes.find(note => note.id === id) !== existing) return;
    editHistory.images((latestDraftRef.current.images ?? []).filter(image => image.id !== imageId), 'removeImage');
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ message: '', visible: false }), 1600);
  };

  // Init from route
  useEffect(() => {
    // Store updates from each keystroke must not reinitialize local text from
    // an older render. Initialize once per route, or when its record arrives.
    if (initializedRouteRef.current === id) {
      if (!isNew && existing) {
        const loaded = loadedContentRef.current, draft = latestDraftRef.current;
        const externallyChanged = !sameEditorFields(existing,loaded);
        const locallyClean = sameEditorFields(draft,loaded);
        if (externallyChanged && locallyClean) {
          // A background/scenario edit invalidates old modal ownership/history, not authored source truth.
          const fields = { title: existing.title??'', content: existing.content??'', folderId: existing.folderId??'unfiled', ...noteImageFields(existing.images), ...checklistFields(existing) };
          editHistory.load(fields); setTitle(fields.title); setContent(fields.content); setFolderId(fields.folderId); setImages(fields.images);setChecklistDraft(checklistFields(fields));
          loadedContentRef.current = fields;
          latestDraftRef.current = { ...fields, isNew: false, isTrashed, existingId: existing.id };
        }
      }
      return;
    }
    if (isNew || !id) {
      initializedRouteRef.current = id;
      savedNewRef.current = false;
      savedNewIdRef.current = null;
      editHistory.load({ title: '', content: '' });
      setTitle('');
      setContent('');
      setFolderId('unfiled'); setImages(undefined);
      setChecklistDraft({});
      latestDraftRef.current = { title: '', content: '', folderId: 'unfiled', isNew, isTrashed, existingId: undefined };
      isFirstLoadRef.current = true;
      return;
    }

    if (!existing) return;
    const adoptingNewNote = initializedRouteRef.current === 'new' && savedNewIdRef.current === id;
    initializedRouteRef.current = id;
    if (adoptingNewNote) {
      // Adopt the new persistent ID without overwriting characters entered
      // between the first input and the router's replace render.
      latestDraftRef.current = { ...latestDraftRef.current, isNew: false, existingId: id };
      isFirstLoadRef.current = false;
      return;
    }
    editHistory.load({ title: existing.title ?? '', content: existing.content ?? '', ...noteImageFields(existing.images), ...checklistFields(existing) });
    setTitle(existing.title ?? '');
    setContent(existing.content ?? '');
    setFolderId(existing.folderId ?? 'unfiled'); setImages(existing.images);
    setChecklistDraft(checklistFields(existing));
    loadedContentRef.current = { title: existing.title ?? '', content: existing.content ?? '', folderId: existing.folderId ?? 'unfiled', ...noteImageFields(existing.images), ...checklistFields(existing) };
    // StrictMode can clean up before queued setState calls are committed.
    // Exit persistence must already reflect this route's loaded note, never
    // blank initial state or the previous route's draft.
    latestDraftRef.current = { ...loadedContentRef.current, isNew, isTrashed, existingId: existing.id };
    isFirstLoadRef.current = true;
  }, [existing, id, isNew, isTrashed]);

  // 新建笔记页：进入后默认聚焦内容区并弹出键盘
  useLayoutEffect(() => {
    if (!isNew) return;
      const textarea = contentTextareaRef.current;
      const active = document.activeElement;
      // Default focus must not steal an input the user already selected,
      // or activate the keyboard after this activity was backgrounded.
      if (!textarea || textarea.disabled || textarea.closest('[inert]') || textarea.getClientRects().length === 0
        || active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        || (active instanceof HTMLElement && active.isContentEditable)) return;
      textarea.focus();
      KeyboardService.show();
    // Establish keyboard geometry before the first usable paint. A delayed
    // focus can move controls even before pointerdown reaches this Activity.
  }, [isNew]);

  // 收起键盘时失去焦点
  const prevKeyboardVisible = useRef(keyboardVisible);
  useEffect(() => {
    if (prevKeyboardVisible.current && !keyboardVisible) {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    prevKeyboardVisible.current = keyboardVisible;
  }, [keyboardVisible]);

  // Auto-save
  useEffect(() => {
    if (!id) return;
    if (!isNew && isTrashed) return;
    // 跳过初始化阶段的所有 setState 触发（title/content/folderId 分别触发）
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      return;
    }

    // 只有内容实际变化时才保存（避免打开笔记就更新 updatedAt）
    if (!isNew && existing) {
      const loaded = loadedContentRef.current;
      if (sameEditorFields(latestDraftRef.current,loaded)) {
        return;
      }
    }

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const t = title.trim();
      const c = content.trim();

      if (isNew) {
        if (savedNewRef.current) return;
        if (!t && !c && !images?.length && !authoredChecklist(checklistDraft)) return;
        const created = noteOwner.write(()=>addNote({ title, content, folderId, ...noteImageFields(images), ...checklistFields(checklistDraft) }));
        savedNewRef.current = true;
        savedNewIdRef.current=created.id;editHistory.adopt(created.id);
        navigateTo(adoptedNoteEditorUrl(created.id, location.pathname, location.search), { replace: true });
        return;
      }

      if (!existing || !sourceStillCurrent()) return;
      const fields=editorFields(latestDraftRef.current),patch=editorPatch(loadedContentRef.current,fields);
      if(Object.keys(patch).length)noteOwner.write(()=>updateNote(existing.id,patch));
      loadedContentRef.current = fields;
    }, NOTES_CONFIG.autoSaveDelayMs);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [addNote, content, existing, folderId, id, images, checklistDraft, isNew, isTrashed, navigateTo, title, updateNote, location.pathname, location.search]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      persistOnExitRef.current();
    };
  }, []);

  const currentTime = existing?.updatedAt ?? TimeService.now();
  const wordCount = countWords([content,...(checklistDraft.hasChecklist?(checklistDraft.checklist??[]).map(row=>row.text):[])].join('\n'));

  const topPad = statusBarHeight;
  const editorPad = dimens.note_editor_padding;

  const currentFolderName = useMemo(() => {
    const found = folders.find(f => f.id === folderId);
    return found ? getFolderDisplayName(found, s) : s.folder_unfiled;
  }, [folderId, folders, s]);

  const saveNow = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (!isNew && isTrashed) return;
    const t = title.trim();
    const c = content.trim();

    if (isNew) {
      if (savedNewRef.current) return;
      if (!t && !c && !images?.length && !authoredChecklist(checklistDraft)) return;
      const created=noteOwner.write(()=>addNote({ title, content, folderId, ...noteImageFields(images), ...checklistFields(checklistDraft) }));
      savedNewIdRef.current=created.id;
      savedNewRef.current = true;
      return;
    }

    if (!existing || !sourceStillCurrent()) return;
    // 只有内容实际变化时才保存
    const loaded = loadedContentRef.current;
    const fields=editorFields(latestDraftRef.current);if(sameEditorFields(fields,loaded))return;
    noteOwner.write(()=>updateNote(existing.id,editorPatch(loaded,fields)));
    loadedContentRef.current=fields;
  };

  persistOnExitRef.current = () => {
    const draft = latestDraftRef.current;
    if (draft.isTrashed) return;
    if (draft.isNew) {
      if (savedNewRef.current || (!draft.title.trim() && !draft.content.trim() && !draft.images?.length && !authoredChecklist(draft))) return;
      savedNewRef.current = true;
      const created=noteOwner.write(()=>addNote(editorFields(draft)));savedNewIdRef.current=created.id;
      return;
    }
    if (!draft.existingId || !sourceStillCurrent()) return;
    const loaded = loadedContentRef.current;
    if (sameEditorFields(draft,loaded)) return;
    noteOwner.write(()=>updateNote(draft.existingId!,editorPatch(loaded,editorFields(draft))));
    loadedContentRef.current = editorFields(draft);
  };

  const enableChecklist=()=>{
    if(!canInteract()||imagePicker.busy||editHistory.isComposing())return;
    const current=editHistory.getSnapshot();
    editHistory.document({hasChecklist:true,checklist:current.checklist??[]},current.selection,'enableChecklist');
    editHistory.focusChecklist();
  };
  const checklistText=(rowId:string,element:HTMLTextAreaElement,event:Event,tail:boolean)=>{
    if(!canInteract()||imagePicker.busy)return;
    const current=editHistory.getSnapshot(),before=current.checklist??[],rows=changeChecklistText(before,rowId,element.value,tail);
    if(!rows)return;
    const normalized=element.value.replace(/\r\n?/g,'\n'),index=before.findIndex(row=>row.id===rowId),parts=normalized.split('\n');
    while(parts.length>1&&parts.at(-1)==='')parts.pop();
    const target=rows[(index<0?before.length:index)+parts.length-1];
    if(!target)return;
    const caret=parts.length>1?parts.at(-1)!.length:element.selectionStart??0;
    editHistory.document({hasChecklist:true,checklist:rows},{field:'content',itemId:target.id,start:caret,end:caret},(event as InputEvent).inputType||'insertFromPaste');
    if(!editHistory.isComposing()){if(normalized.endsWith('\n'))editHistory.focusChecklist();else if(parts.length>1)editHistory.focusChecklist(target.id,caret);}
  };
  const checklistToggle=(rowId:string,completed:boolean)=>{
    if(!canInteract()||imagePicker.busy||editHistory.isComposing())return;const current=editHistory.getSnapshot();
    if(!current.checklist?.some(row=>row.id===rowId))return;
    editHistory.document({checklist:current.checklist.map(row=>row.id===rowId?{...row,completed}:row)},current.selection,'toggleChecklist');
  };
  const checklistRemove=(rowId:string)=>{
    if(!canInteract()||imagePicker.busy||editHistory.isComposing())return;const current=editHistory.getSnapshot(),rows=current.checklist??[],index=rows.findIndex(row=>row.id===rowId);
    if(index<0)return;const next=rows.filter(row=>row.id!==rowId),focus=next[Math.max(0,index-1)];
    editHistory.document({checklist:next},focus?{field:'content',itemId:focus.id,start:focus.text.length,end:focus.text.length}:{field:'content',itemId:rowId,start:0,end:0},'removeChecklist');
    if(current.selection.itemId===rowId)editHistory.focusChecklist(focus?.id,focus?.text.length??0);
  };

  const owner = useRef<{ key: string; id: string | undefined; note: typeof existing } | null>(null);
  if (sheet && owner.current?.key !== location.key) owner.current = { key: location.key, id, note: existing };
  const closedEntry = useRef<string | null>(null), pendingEntry = useRef<string | null>(null);
  useEffect(() => { pendingEntry.current = null; }, [location.key]);
  const overlayAvailable = !!sheet && owner.current?.id === id && (isNew
    ? sheet === 'folder' : !!existing && owner.current?.note === existing && (sheet === 'menu' || sheet === 'permanentDelete' ? true : !isTrashed));
  const claim = () => {
    if (!overlayAvailable || closedEntry.current === location.key) return false;
    if (!isNew && useNotesStore.getState().notes.find(note => note.id === id) !== owner.current?.note) return false;
    closedEntry.current = location.key; return true;
  };
  const openOnce = (open: () => void) => {
    if (pendingEntry.current === location.key) return;
    pendingEntry.current = location.key; open();
  };
  const folderSubmit = (target: string) => {
    const folder = useNotesStore.getState().folders.find(folder => folder.id === target && folder.id !== 'all');
    if (!folder || !claim()) return;
    publishFields({ folderId: folder.id });
    back();
    showToast(s.toast_moved_to_editor_prefix + getFolderDisplayName(folder, s) + s.toast_moved_to_suffix);
  };
  const menuItemClass = 'w-full text-left px-3 min-h-12 py-3 rounded-[14px] active:bg-black/5 disabled:opacity-40';

  const handleDone = () => {
    if(!noteOwner.active())return;
    saveNow();
    back();
  };

  const openSearch = () => {
    if (existing && canInteract() && !imagePicker.busy && !editHistory.isComposing()) {
      openOnce(() => go('notes.editor.search.open', { id: id! }));
    }
  };

  const openAi = () => {
    if (existing && canInteract() && !imagePicker.busy && !editHistory.isComposing()) {
      window.__OS__?.keyboard.hide();
      openOnce(() => go('notes.editor.ai.open', { id: id! }));
    }
  };

  const sharePayload = noteTextShareIntent({ title, content, ...checklistDraft });
  const shareNote = useNoteTextShare({
    routeKey: location.key,
    isActive: () => !!existing && canInteract() && !imagePicker.busy,
    intent: () => noteTextShareIntent(latestDraftRef.current),
    onUnavailable: () => showToast(s.share_text_unavailable),
  });

  if (!isNew && id && !existing) {
    return (
      <div className="h-full w-full bg-app-surface flex flex-col">
        <div className="shrink-0 bg-app-surface" style={{ paddingTop: topPad }}>
          <div className="h-12 px-3 flex items-center">
            <button
              {...bindBack()}
              className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            >
              <IcNavBack size={24} className="text-black" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-[#9aa0aa]">
          {s.editor_note_not_found}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-app-surface relative flex flex-col overflow-hidden" data-notes-editor data-keep-keyboard>
      <div className="flex flex-col h-full min-h-0" data-notes-editor-background inert={!!sheet} aria-hidden={sheet ? true : undefined}>
      {/* Top bar (back / undo / redo / done) */}
      <div className="shrink-0 bg-app-surface" style={{ paddingTop: topPad }}>
        <div className="h-12 px-4 flex items-center">
          <button
            onClick={handleDone}
            className="w-10 h-10 -ml-2 flex items-center justify-center active:opacity-70"
            aria-label={s.action_back}
          >
            <IcNavBack size={24} className="text-black" />
          </button>

          {focused ? <button
            className="notes-editor-view-toggle w-10 h-10 items-center justify-center active:opacity-70"
            onPointerDown={event => event.preventDefault()} aria-label={s.editor_view_parallel}
            {...bindTap('notes.editor.view.parallel.open', { params: { id: id ?? 'new' } })}>
            <IcCollapse size={22} className="text-black" />
          </button> : <button
            className="notes-editor-view-toggle w-10 h-10 items-center justify-center active:opacity-70"
            onPointerDown={event => event.preventDefault()} aria-label={s.editor_view_full}
            {...bindTap('notes.editor.view.full.open', { params: { id: id ?? 'new' } })}>
            <IcExpand size={22} className="text-black" />
          </button>}

          <div className="flex-1" />

          {keyboardVisible ? (
            <>
              <button
                {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.undo' } : { kind: 'action', id: 'notes.editor.undo' }, { onTrigger: editHistory.undo })}
                onPointerDown={event => event.preventDefault()}
                disabled={!editHistory.canUndo || imagePicker.busy}
                className="w-10 h-10 flex items-center justify-center active:opacity-70"
                aria-label={s.action_undo}
              >
                <IcUndo size={22} className={editHistory.canUndo && !imagePicker.busy ? 'text-black' : 'text-[#c8c8c8]'} />
              </button>
              <button
                {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.redo' } : { kind: 'action', id: 'notes.editor.redo' }, { onTrigger: editHistory.redo })}
                onPointerDown={event => event.preventDefault()}
                disabled={!editHistory.canRedo || imagePicker.busy}
                className="w-10 h-10 flex items-center justify-center active:opacity-70"
                aria-label={s.action_redo}
              >
                <IcRedo size={22} className={editHistory.canRedo && !imagePicker.busy ? 'text-black' : 'text-[#c8c8c8]'} />
              </button>
              <button
                disabled={!existing || isTrashed || imagePicker.busy || editHistory.isComposing()}
                {...bindTap('notes.editor.search.open', { params: { id: id ?? 'new' }, onTrigger: openSearch })}
                className="w-10 h-10 flex items-center justify-center active:opacity-70 disabled:opacity-40"
                aria-label={s.editor_find}
              >
                <IcSearch size={22} className="text-black" />
              </button>
              <button
                onClick={handleDone}
                className="w-10 h-10 -mr-1 flex items-center justify-center active:opacity-70"
                aria-label={s.action_done}
              >
                <IcCheck size={26} className="text-black" />
              </button>
            </>
          ) : (
            <>
              <button
                disabled={!existing || isTrashed || imagePicker.busy}
                data-notes-ai-open="editor"
                {...bindTap('notes.editor.ai.open', { params: { id: id ?? 'new' }, onTrigger: openAi })}
                className="notes-editor-ai-open w-10 h-10 items-center justify-center active:opacity-70 disabled:opacity-40"
                aria-label={s.ai_title}
              >
                <IcAiNotes size={23} className="text-[#876ac8]" />
              </button>
              <button
                className="w-10 h-10 flex items-center justify-center active:opacity-70 disabled:opacity-40"
                aria-label={s.action_share} title={s.share_text_only}
                disabled={!existing || isTrashed || imagePicker.busy || !sharePayload}
                {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.share' } : { kind: 'action', id: 'notes.editor.share' }, { onTrigger: shareNote })}
              >
                <IcShare size={22} className="text-black" />
              </button>
              <button
                disabled={!existing || isTrashed || imagePicker.busy}
                {...bindTap('notes.editor.search.open', { params: { id: id ?? 'new' }, onTrigger: openSearch })}
                className="w-10 h-10 flex items-center justify-center active:opacity-70 disabled:opacity-40"
                aria-label={s.editor_find}
              >
                <IcSearch size={22} className="text-black" />
              </button>
              <button
                disabled={!existing || imagePicker.busy}
                {...bindTap('notes.editor.menu.open', { params: { id: id ?? 'new' }, onTrigger: () => { if (existing) openOnce(() => go('notes.editor.menu.open', { id: id! })); } })}
                className="w-10 h-10 -mr-1 flex items-center justify-center active:opacity-70"
                aria-label={s.action_more}
              >
                <IcMoreVert size={22} className="text-black" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={editorScrollRef} className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical" data-notes-editor-scroll style={{ minHeight: 0, paddingBottom: 18 }}>
        <div className="pt-2" style={{ width: '100%', maxWidth: 760, marginInline: 'auto', boxSizing: 'border-box', paddingLeft: editorPad, paddingRight: editorPad }}>
          {existing && isTrashed ? (
            <div className="mb-3 rounded-[14px] px-4 py-3" style={{ backgroundColor: '#fff4d6' }}>
              <div className="text-[13px] text-black">{s.editor_trash_banner}</div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="h-9 px-4 rounded-[14px] bg-app-surface text-[14px] active:opacity-80"
                  {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.restore.submit' } : { kind: 'action', id: 'notes.editor.restore.submit' }, { onTrigger: () => {
                    if (useNotesStore.getState().notes.find(note => note.id === existing.id) !== existing) return;
                    restoreNote(existing.id); showToast(s.toast_restored);
                  } })}
                >
                  {s.action_restore}
                </button>
                <button
                  className="h-9 px-4 rounded-[14px] bg-app-surface text-[14px] text-[#ff3b30] active:opacity-80"
                  {...bindTap('notes.editor.permanentDelete.open', { params: { id: id! }, onTrigger: () => openOnce(() => go('notes.editor.permanentDelete.open', { id: id! })) })}
                >
                  {s.action_permanent_delete}
                </button>
              </div>
            </div>
          ) : null}

          <input
            data-benchmark-field="notes-title"
            ref={titleInputRef}
            value={title}
            onChange={e => editHistory.change('title', e.currentTarget, e.nativeEvent)}
              onSelect={e => editHistory.select('title', e.currentTarget)}
              onKeyDown={editHistory.keyDown}
              onBlur={editHistory.blur}
              onCompositionStart={editHistory.compositionStart}
              onCompositionEnd={editHistory.compositionEnd}
              data-action={focused ? 'notes.focus.editor.title.input' : 'notes.editor.title.input'} data-action-type="input" data-action-params={JSON.stringify({ value: title })}
            placeholder={s.editor_title_placeholder}
            className="w-full font-semibold text-black placeholder:text-[#cccccc] outline-none"
            style={{
              fontSize: dimens.note_editor_title_size,
              lineHeight: '30px',
            }}
            disabled={(!!existing && isTrashed) || imagePicker.busy}
          />

          <div className="notes-editor-metadata" data-notes-editor-metadata style={{ color: colors.text_secondary }}>
            <span data-notes-meta-time>{formatHeaderTime(currentTime, s)}</span>
            {settings.showWordCount && <span data-notes-meta-count>{s.editor_word_count_prefix}{wordCount}{s.editor_word_count_suffix}</span>}
            <button
              type="button"
              className="notes-editor-metadata-folder"
              disabled={(!!existing && isTrashed) || imagePicker.busy}
              {...bindTap('notes.editor.folder.open', { params: { id: id ?? 'new' }, onTrigger: () => {
                if (existing && isTrashed) return;
                openOnce(() => go('notes.editor.folder.open', { id: id ?? 'new' }));
              } })}
              aria-label={s.folders} aria-haspopup="dialog" aria-expanded={folderPickerOpen} title={currentFolderName}
            >
              <span>{currentFolderName}</span><IcFolderMenuArrow size={12} />
            </button>
            {existing && typeof existing.alarmAt === 'number' && <span>{s.alarm_label_prefix}{formatHeaderTime(existing.alarmAt, s)}</span>}
            {existing && isPrivate && <span>{s.label_private}</span>}
            {isLocked && <span className="inline-flex items-center" aria-label={s.label_encrypted}>
              <IcNoteLock size={14} color={colors.text_secondary} />
            </span>}
          </div>

          <div className="mt-2 relative">
            {content.trim().length === 0 && !images?.length && !checklistDraft.hasChecklist ? (
              <div
                className="absolute inset-0 flex items-baseline gap-2 pointer-events-none"
                style={{ zIndex: 1, paddingTop: 12, fontSize: 16, lineHeight: '26px', fontFamily: 'inherit' }}
              >
                <span className="text-[#d7d7d7] text-[16px] leading-[26px]">{s.editor_start_writing}</span>
                <button
                  type="button"
                  onClick={() => showToast(s.toast_mind_note_dev)}
                  className="pointer-events-auto inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#fff2d7] text-[#f6c444] text-[14px] font-medium active:opacity-80"
                >
                  {s.editor_create_mind_note}
                </button>
              </div>
            ) : null}
            <textarea
              data-benchmark-field="notes-content"
              ref={contentTextareaRef}
              value={content}
              onChange={e => editHistory.change('content', e.currentTarget, e.nativeEvent)}
              onSelect={e => editHistory.select('content', e.currentTarget)}
              onKeyDown={editHistory.keyDown}
              onBlur={editHistory.blur}
              onCompositionStart={editHistory.compositionStart}
              onCompositionEnd={editHistory.compositionEnd}
              data-action={focused ? 'notes.focus.editor.content.input' : 'notes.editor.content.input'} data-action-type="input" data-action-params={JSON.stringify({ value: content })}
              className="w-full min-h-[520px] outline-none resize-none border-0 bg-transparent"
              style={{
                color: 'rgba(0,0,0,0.87)',
                minHeight: checklistDraft.hasChecklist ? (content?100:26) : images?.length ? 120 : 520,
                paddingTop: 12,
                paddingLeft: 0,
                fontSize: 16,
                lineHeight: '26px',
                fontFamily: 'inherit',
              }}
              disabled={(!!existing && isTrashed) || imagePicker.busy}
            />
          </div>
          {checklistDraft.hasChecklist&&<NoteChecklist noteId={savedNewIdRef.current??id??'new'} items={checklistDraft.checklist??[]} disabled={!!sheet||isTrashed||imagePicker.busy} active={canInteract} isComposing={editHistory.isComposing}
            onText={checklistText} onToggle={checklistToggle} onRemove={checklistRemove} register={editHistory.registerChecklistControl} select={editHistory.selectChecklist} keyDown={editHistory.keyDown}
            compositionStart={editHistory.compositionStart} compositionEnd={editHistory.compositionEnd}/>}
          {imagePicker.busy && <p role="status" className="text-[14px] py-3">{s.image_loading}</p>}
          {imagePicker.error && <p role="alert" className="text-[14px] py-3">{s.image_pick_failed}</p>}
          {!!images?.length && <section className="notes-image-collection" aria-label={s.image_collection}>
            {images.map(image => <NoteImageBlock key={image.id} image={image} readOnly={isTrashed} busy={imagePicker.busy}
              openProps={bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.image.item.open' } : { kind: 'action', id: 'notes.editor.image.item.open' }, { params: { imageId: image.id }, onTrigger: () => openImage(image) })}
              removeProps={bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.image.item.remove' } : { kind: 'action', id: 'notes.editor.image.item.remove' }, { params: { imageId: image.id }, onTrigger: () => removeImage(image.id) })} />)}
          </section>}
        </div>
      </div>

      <NoteFormattingToolbar
        noteId={id ?? 'new'}
        keyboardVisible={keyboardVisible}
        bottomInset={bottomGestureHeight}
        focused={focused}
        aiBlocked={!existing || isTrashed || imagePicker.busy || editHistory.isComposing()}
        editBlocked={isTrashed || imagePicker.busy || editHistory.isComposing()}
        checklistEnabled={!!checklistDraft.hasChecklist}
        onAi={openAi}
        onChecklist={enableChecklist}
        onImage={imagePicker.pick}
      />

      </div>

      <Toast message={toast.message} visible={toast.visible} />

      {sheet === 'ai' && <NoteAiPanel available={overlayAvailable} />}

      {sheet === 'search' && <NoteTextSearch key={location.key} focused={focused} available={overlayAvailable}
        active={() => overlayAvailable && noteOwner.active()}
        documents={[{ id: 'title', text: title }, { id: 'content', text: content }, ...(checklistDraft.hasChecklist ? (checklistDraft.checklist ?? []).map(item => ({ id: `checklist:${item.id}`, text: item.text })) : [])]} />}

      {folderPickerOpen && <EditorSheet kind="folder" title={s.select_folder_title}>
        {!overlayAvailable && <p role="status">{s.editor_overlay_unavailable}</p>}
        {folders.filter(folder => folder.id !== 'all').map(folder => <button key={folder.id}
          disabled={!overlayAvailable} className={menuItemClass + ' flex items-center justify-between'}
          {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.folder.item.submit' } : { kind: 'action', id: 'notes.editor.folder.item.submit' }, { params: { folderId: folder.id }, onTrigger: () => folderSubmit(folder.id) })}>
          <span>{getFolderDisplayName(folder, s)}</span>{folder.id === folderId && <IcCheck size={20} />}
        </button>)}
      </EditorSheet>}

      {menuOpen && <EditorSheet kind="menu" title={s.action_more}>
        {!overlayAvailable && <p role="status">{s.editor_overlay_unavailable}</p>}
        {isTrashed ? <>
          <button disabled={!overlayAvailable} className={menuItemClass}
            {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.menu.restore.submit' } : { kind: 'action', id: 'notes.editor.menu.restore.submit' }, { onTrigger: () => {
              if (!claim()) return; restoreNote(id!); back(); showToast(s.toast_restored);
            } })}>{s.action_restore}</button>
          <button disabled={!overlayAvailable} className={menuItemClass + ' text-[#ff3b30]'}
            {...bindTap('notes.editor.menu.permanentDelete.open', { params: { id: id! }, onTrigger: () => openOnce(() => go('notes.editor.menu.permanentDelete.open', { id: id! })) })}>{s.action_permanent_delete}</button>
        </> : <>
          <button disabled={!overlayAvailable} className={menuItemClass}
            {...bindTap('notes.editor.reminder.open', { params: { id: id! }, onTrigger: () => openOnce(() => go('notes.editor.reminder.open', { id: id! })) })}>{s.action_set_reminder}</button>
          {isPrivate ? <button disabled={!overlayAvailable} className={menuItemClass}
            {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.menu.unprivate.submit' } : { kind: 'action', id: 'notes.editor.menu.unprivate.submit' }, { onTrigger: () => { if (!claim()) return; unhideNote(id!); back(); showToast(s.toast_unset_private); } })}>{s.action_unset_private}</button>
          : <button disabled={!overlayAvailable} className={menuItemClass}
            {...bindTap('private.open', { onTrigger: () => { if (!claim()) return; hideNote(id!); back(); go('private.open', {}, { mode: 'replace' }); } })}>{s.action_set_private}</button>}
          <button disabled className={menuItemClass}>{s.action_send_to_desktop}</button>
          <button disabled={!overlayAvailable} className={menuItemClass}
            {...bindTap('notes.editor.menu.folder.open', { params: { id: id! }, onTrigger: () => openOnce(() => go('notes.editor.menu.folder.open', { id: id! })) })}>{s.action_move_to}</button>
          <button disabled={!overlayAvailable} className={menuItemClass + ' text-[#ff3b30]'}
            {...bindTap('notes.editor.delete.open', { params: { id: id! }, onTrigger: () => openOnce(() => go('notes.editor.delete.open', { id: id! })) })}>{s.action_delete}</button>
        </>}
      </EditorSheet>}

      {(sheet === 'delete' || sheet === 'permanentDelete') && <EditorSheet kind={sheet}
        title={sheet === 'delete' ? s.editor_delete_title : s.editor_delete_forever_title}>
        <p className="px-3 pb-4" role={!overlayAvailable ? 'status' : undefined}>{!overlayAvailable ? s.editor_overlay_unavailable : sheet === 'delete' ? s.editor_delete_hint : s.confirm_permanent_delete}</p>
        {sheet === 'delete' ? <button disabled={!overlayAvailable || isTrashed} className={menuItemClass + ' text-[#ff3b30]'}
          {...bindTap('notes.editor.delete.confirm', { onTrigger: () => { if (!claim() || isTrashed) return; deleteNote(id!); back(); go('notes.editor.delete.confirm'); } })}>{s.action_delete}</button>
        : <button disabled={!overlayAvailable || !isTrashed} className={menuItemClass + ' text-[#ff3b30]'}
          {...bindTap('notes.editor.permanentDelete.confirm', { onTrigger: () => { if (!claim() || !isTrashed) return; deleteNoteForever(id!); back(); go('notes.editor.permanentDelete.confirm'); } })}>{s.action_permanent_delete}</button>}
      </EditorSheet>}

      {reminderOpen && <DateTimeDialog
        key={location.key} title={s.action_set_reminder} initialTimestamp={existing?.alarmAt} available={overlayAvailable}
        onConfirm={timestamp => { if (!claim()) return; updateNote(id!, { alarmAt: timestamp }); back(); showToast(s.toast_reminder_set); }}
        onClear={typeof existing?.alarmAt === 'number' ? () => { if (!claim()) return; updateNote(id!, { alarmAt: undefined }); back(); showToast(s.toast_reminder_cleared); } : undefined}
      />}

    </div>
  );
};

export default NoteEditorPage;
