import {
  createAppStoreWithActions,
  registerStateAdapter,
} from "../../os/createAppStore";
import type { Draft, DraftInput, DraftOwner, Message, ReplyInput } from "./types";
import { replyEditor } from './replyDrafts';
import { saveMailto, updateMailto } from './mailtoDrafts';
import { isDocumentReference, type DocumentReference } from "../../os/utils/documentReference";
const messages: Message[] = [
  {
    id: "annotation_review_batch3",
    subject: "数据标注复核",
    from: "评测项目组",
    date: "2026-09-18 09:12",
    body: "请在 2026-09-23 17:00 前复核第3批标注异常。回复前核对样本 184–220。",
  },
  {
    id: "annotation_review_batch2",
    subject: "数据标注复核（第2批）",
    from: "评测项目组",
    date: "2026-09-17 16:20",
    body: "第2批已完成，请勿创建新任务。",
  },
];
interface State {
  messages: Message[];
  selectedId: string | null;
  verifiedIds: string[];
  starredIds: string[];
  archivedIds?: string[];
  unreadIds?: string[];
  composeOpen: boolean;
  draftInput: DraftInput;
  drafts: Draft[];
  editingDraftId: string | null;
  editorBuffers: Record<string, DraftInput>;
  replyInputs?: Record<string, ReplyInput>;
  mailtoInputs?: Record<string, ReplyInput>;
  _temp: { composeEpoch: number; editingSource?: Draft };
}
function editorSourceChanged(state: State): boolean {
  return Boolean(state.editingDraftId && state._temp?.editingSource
    && state.drafts.find(item => item.id === state.editingDraftId) !== state._temp.editingSource);
}
function keepConflict(state: State, buffers: Record<string, DraftInput>): void {
  if (!editorSourceChanged(state)) return;
  let ordinal = 1;
  const prefix = `conflict:${encodeURIComponent(state.editingDraftId ?? '')}:`;
  while (Object.prototype.hasOwnProperty.call(buffers, prefix + ordinal)) ordinal++;
  buffers[prefix + ordinal] = { ...state.draftInput };
  delete buffers[`saved:${state.editingDraftId}`];
}
export function hasMailInput(input: DraftInput | undefined): boolean {
  return Boolean(input && (input.to || input.subject || input.body || input.attachments?.length));
}
function staleEditorExit(state: State): Partial<State> {
  if (!editorSourceChanged(state)) return {};
  const buffers = { ...state.editorBuffers }; keepConflict(state, buffers);
  return { editingDraftId: null, editorBuffers: buffers, draftInput: { ...(buffers.new ?? { to: '', subject: '', body: '' }) } };
}
interface Actions {
  updateMailto: (recipient: string, key: string, patch: Partial<Pick<DraftInput, 'to' | 'subject' | 'body'>>) => void;
  saveMailto: (recipient: string, key: string) => boolean;
  toggleStar: (source: Message) => void;
  setArchived: (source: Message, archived: boolean) => boolean;
  setUnread: (source: Message, unread: boolean) => boolean;
  updateReply: (messageId: string, expectedKey: string, body: string) => void;
  saveReply: (messageId: string, expectedKey: string) => boolean;
  open: (id: string | null) => void;
  verify: (id: string) => void;
  beginCompose: () => void;
  openDraft: (id: string) => void;
  openRecovery: (key: string) => void;
  closeCompose: () => void;
  updateDraft: (patch: Partial<DraftInput>) => void;
  saveDraft: () => void;
  addAttachment: (owner: DraftOwner, reference: DocumentReference) => void;
  removeAttachment: (id: string) => void;
}
export const useMailStore = createAppStoreWithActions<State, Actions>(
  "mail",
  {
    messages,
    selectedId: null,
    verifiedIds: [],
    starredIds: [],
    archivedIds: [],
    composeOpen: false,
    draftInput: { to: "", subject: "", body: "" },
    drafts: [],
    editingDraftId: null,
    editorBuffers: {},
    replyInputs: undefined,
    mailtoInputs: undefined,
    _temp: { composeEpoch: 0 },
  },
  (set) => ({
    updateMailto: (recipient, key, patch) => set(state => updateMailto(state, recipient, key, patch) ?? state),
    saveMailto: (recipient, key) => {
      let saved = false;
      set(state => { const patch = saveMailto(state, recipient, key); if (!patch) return state; saved = true; return patch; });
      return saved;
    },
    setUnread: (source, unread) => {
      let changed = false;
      set(state => {
        const matches = state.messages.filter(message => message.id === source.id);
        const ids = state.unreadIds ?? [];
        if (!source.id || matches.length !== 1 || matches[0] !== source || ids.includes(source.id) === unread) return state;
        changed = true;
        return { unreadIds: unread ? [...ids, source.id] : ids.filter(id => id !== source.id) };
      });
      return changed;
    },
    setArchived: (source, archived) => {
      let changed = false;
      set(state => {
        const matches = state.messages.filter(message => message.id === source.id);
        const ids = state.archivedIds ?? [];
        if (!source.id || matches.length !== 1 || matches[0] !== source || ids.includes(source.id) === archived) return state;
        changed = true;
        return { archivedIds: archived ? [...ids, source.id] : ids.filter(id => id !== source.id) };
      });
      return changed;
    },
    toggleStar: source => set(s => {
      if (s.messages.find(message => message.id === source.id) !== source) return s;
      const starred = s.starredIds ?? [];
      return { starredIds: starred.includes(source.id) ? starred.filter(id => id !== source.id) : [...starred, source.id] };
    }),
    updateReply: (messageId, expectedKey, body) => set(s => {
      const view = replyEditor(s, messageId);
      if (!view.available || view.key !== expectedKey) return s;
      return { replyInputs: { ...s.replyInputs, [messageId]: { ...view.input, body } } };
    }),
    saveReply: (messageId, expectedKey) => {
      let saved = false;
      set(s => {
        const view = replyEditor(s, messageId);
        if (!view.available || view.key !== expectedKey || !view.input.body.trim()) return s;
        const occupied = new Set(s.drafts.map(draft => draft.id));
        let ordinal = s.drafts.length + 1;
        while (occupied.has(`draft-${ordinal}`)) ordinal++;
        const id = view.draft?.id ?? `draft-${ordinal}`;
        const { draftId: _draftId, draftKey: _draftKey, ...input } = view.input;
        const record = { id, ...input };
        saved = true;
        return {
          drafts: view.draft ? s.drafts.map(draft => draft.id === id ? record : draft) : [...s.drafts, record],
          replyInputs: { ...s.replyInputs, [messageId]: { ...input, draftId: id, draftKey: JSON.stringify(record) } },
        };
      });
      return saved;
    },
    open: (id) => set(s => ({ ...staleEditorExit(s), selectedId: id, composeOpen: false, _temp: { ...(editorSourceChanged(s) ? {} : s._temp), composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 } })),
    verify: (id) =>
      set((s) => !s.messages.some(message => message.id === id) ? s : ({
        verifiedIds: s.verifiedIds.includes(id)
          ? s.verifiedIds
          : [...s.verifiedIds, id],
      })),
    beginCompose: () => set((s) => {
      if (editorSourceChanged(s)) return { ...staleEditorExit(s), composeOpen: true, selectedId: null, _temp: { composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 } };
      if (!s.editingDraftId) return { composeOpen: true, selectedId: null, _temp: { composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 } };
      return {
        composeOpen: true, selectedId: null, editingDraftId: null,
        _temp: { composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 },
        editorBuffers: { ...s.editorBuffers, [`saved:${s.editingDraftId}`]: { ...s.draftInput } },
        draftInput: { ...(s.editorBuffers?.new ?? { to: '', subject: '', body: '' }) },
      };
    }),
    openDraft: (id) => set((s) => {
      const saved = s.drafts.find(draft => draft.id === id);
      if (!saved || saved.replyTo) return s;
      const key = s.editingDraftId ? `saved:${s.editingDraftId}` : 'new';
      const buffers = { ...s.editorBuffers };
      if (editorSourceChanged(s)) keepConflict(s, buffers);
      else buffers[key] = { ...s.draftInput };
      return {
        composeOpen: true, selectedId: null, editingDraftId: id, editorBuffers: buffers,
        _temp: { composeEpoch: (s._temp?.composeEpoch ?? 0) + 1, editingSource: saved },
        draftInput: { ...(buffers[`saved:${id}`] ?? { to: saved.to, subject: saved.subject, body: saved.body, ...(saved.attachments?.length ? { attachments: saved.attachments.map(reference => ({ ...reference })) } : {}) }) },
      };
    }),
    openRecovery: (key) => set(s => {
      if (!key.startsWith('conflict:') || !Object.prototype.hasOwnProperty.call(s.editorBuffers, key)) return s;
      const newBuffer = s.editingDraftId ? s.editorBuffers.new : s.draftInput;
      if (hasMailInput(newBuffer)) return s;
      const buffers = { ...s.editorBuffers };
      if (s.editingDraftId) {
        if (editorSourceChanged(s)) keepConflict(s, buffers);
        else buffers[`saved:${s.editingDraftId}`] = { ...s.draftInput };
      }
      const recovered = buffers[key]; delete buffers[key];
      return { composeOpen: true, selectedId: null, editingDraftId: null, draftInput: { ...recovered }, editorBuffers: buffers,
        _temp: { composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 } };
    }),
    closeCompose: () => set(s => ({ ...staleEditorExit(s), composeOpen: false, _temp: { ...(editorSourceChanged(s) ? {} : s._temp), composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 } })),
    updateDraft: (patch) =>
      set((s) => ({ draftInput: { ...s.draftInput, ...patch } })),
    addAttachment: (owner, reference) => set(s => {
      const key = s.editingDraftId ? `saved:${s.editingDraftId}` : 'new';
      if (!s.composeOpen || editorSourceChanged(s) || owner.key !== key || owner.epoch !== (s._temp?.composeEpoch ?? 0)
        || !isDocumentReference(reference) || (s.editingDraftId && !s.drafts.some(item => item.id === s.editingDraftId))) return s;
      if (s.draftInput.attachments?.some(item => item.id === reference.id)) return s;
      return { draftInput: { ...s.draftInput, attachments: [...(s.draftInput.attachments ?? []), { id: reference.id, path: reference.path, createdAt: reference.createdAt }] } };
    }),
    removeAttachment: id => set(s => {
      if (!s.composeOpen || editorSourceChanged(s)) return s;
      const { attachments, ...text } = s.draftInput;
      if (!attachments?.some(item => item.id === id)) return s;
      const remaining = attachments.filter(item => item.id !== id);
      return { draftInput: remaining.length ? { ...text, attachments: remaining } : text };
    }),
    saveDraft: () =>
      set((s) => {
        if (!s.composeOpen || editorSourceChanged(s) || !s.draftInput.to.trim()
          || !s.draftInput.subject.trim() || !s.draftInput.body.trim()) return s;
        const buffers = { ...s.editorBuffers };
        if (s.editingDraftId) {
          const id = s.editingDraftId;
          // A removed draft must not be silently recreated by a stale editor.
          if (!s.drafts.some(draft => draft.id === id)) return s;
          delete buffers[`saved:${id}`];
          return {
            drafts: s.drafts.map(draft => draft.id === id ? { id, ...s.draftInput } : draft),
            composeOpen: false, editingDraftId: null, editorBuffers: buffers,
            _temp: { composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 },
            draftInput: { ...(buffers.new ?? { to: '', subject: '', body: '' }) },
          };
        }
        delete buffers.new;
        const existingIds = new Set(s.drafts.map(draft => draft.id));
        let nextNumber = s.drafts.length + 1;
        while (existingIds.has(`draft-${nextNumber}`)) nextNumber += 1;
        return {
          drafts: [
            ...s.drafts,
            { id: `draft-${nextNumber}`, ...s.draftInput },
          ],
          composeOpen: false,
          _temp: { composeEpoch: (s._temp?.composeEpoch ?? 0) + 1 },
          editingDraftId: null,
          editorBuffers: buffers,
          draftInput: { to: "", subject: "", body: "" },
        };
      }),
  }),
);
registerStateAdapter("mail", (s: State & Actions) => ({
  route: s.composeOpen ? "compose" : s.selectedId ? "message" : "inbox",
  messages: s.messages,
  selected_message_id: s.selectedId,
  verified_message_ids: s.verifiedIds,
  starred_message_ids: s.starredIds ?? [],
  archived_message_ids: s.archivedIds ?? [],
  unread_message_ids: s.unreadIds ?? [],
  drafts: s.drafts,
  draft_input: s.draftInput,
  editing_draft_id: s.editingDraftId ?? null,
  editor_buffers: s.editorBuffers ?? {},
  draft_count: s.drafts.length,
  send_count: 0,
  deleted_count: 0,
  ...(s.replyInputs !== undefined ? { reply_inputs: s.replyInputs } : {}),
  ...(s.mailtoInputs !== undefined ? { mailto_inputs: s.mailtoInputs } : {}),
}));
