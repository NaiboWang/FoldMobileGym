import { normalizeEmailAddress } from '@/os/utils/emailAddress';
import type { Draft, DraftInput, ReplyInput } from './types';

export type MailtoState = { drafts: Draft[]; mailtoInputs?: Record<string, ReplyInput> };

/** Separate per-recipient buffers never borrow the ordinary Mail editor state. */
export function mailtoEditor(state: MailtoState, recipient: string) {
  const address = normalizeEmailAddress(recipient);
  const buffer = address ? state.mailtoInputs?.[address] : undefined;
  const input: ReplyInput = buffer ?? { to: address ?? '', subject: '', body: '' };
  const saved = buffer?.draftId ? state.drafts.filter(draft => draft.id === buffer.draftId) : [];
  const draft = saved.length === 1 ? saved[0] : undefined;
  const available = !!address && (!buffer?.draftId || !!draft && buffer.draftKey === JSON.stringify(draft));
  return { address, input, draft, available, key: JSON.stringify(input) };
}

export function updateMailto(state: MailtoState, recipient: string, key: string, patch: Partial<Pick<DraftInput, 'to' | 'subject' | 'body'>>): Partial<MailtoState> | null {
  const view = mailtoEditor(state, recipient);
  if (!view.available || view.key !== key || !view.address) return null;
  const next = { ...view.input };
  for (const field of ['to', 'subject', 'body'] as const) {
    if (patch[field] !== undefined) {
      if (typeof patch[field] !== 'string') return null;
      next[field] = patch[field];
    }
  }
  return { mailtoInputs: { ...state.mailtoInputs, [view.address]: next } };
}

export function saveMailto(state: MailtoState, recipient: string, key: string): Partial<MailtoState> | null {
  const view = mailtoEditor(state, recipient);
  if (!view.available || view.key !== key || !view.address || !normalizeEmailAddress(view.input.to)
    || !view.input.subject.trim() || !view.input.body.trim()) return null;
  const used = new Set(state.drafts.map(draft => draft.id));
  let ordinal = 1;
  while (used.has(`draft-${ordinal}`)) ordinal++;
  const id = view.draft?.id ?? `draft-${ordinal}`;
  const { draftId: _draftId, draftKey: _draftKey, ...input } = view.input;
  const draft: Draft = { ...input, id };
  return {
    drafts: view.draft ? state.drafts.map(item => item === view.draft ? draft : item) : [...state.drafts, draft],
    mailtoInputs: { ...state.mailtoInputs, [view.address]: { ...input, draftId: id, draftKey: JSON.stringify(draft) } },
  };
}
