import type { DocumentReference } from '../../os/utils/documentReference';
export interface DraftInput {
  to: string;
  subject: string;
  body: string;
  /** Only stable virtual file identities; byte payloads and blob URLs are not persisted here. */
  attachments?: DocumentReference[];
  /** Explicit original message identity/version; never inferred from display text. */
  replyTo?: { messageId: string; sourceKey: string };
}
export interface Draft extends DraftInput { id: string }
export interface DraftOwner { key: string; epoch: number }
export interface ReplyInput extends DraftInput { draftId?: string; draftKey?: string }

export interface Message {
  id: string;
  subject: string;
  from: string;
  /** Only a provided source fact. Never derive an address from the display name. */
  senderAddress?: string;
  date: string;
  body: string;
}
