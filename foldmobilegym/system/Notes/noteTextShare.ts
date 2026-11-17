import type { IntentPayload } from '../../os/types/manifest';
import type { Note } from './types';
export type NoteShareSource = Pick<Note, 'title' | 'content' | 'hasChecklist' | 'checklist'>;
/** Snapshot authored text only; no note IDs, privacy/folder data, media or fabricated title. */
export function noteTextShareIntent(source: NoteShareSource): IntentPayload | null {
  const parts: string[] = [];
  for (const value of [source.title, source.content]) if (typeof value === 'string' && value.trim()) parts.push(value);
  if (source.hasChecklist && Array.isArray(source.checklist)) {
    const rows = source.checklist.filter(row => row && typeof row.text === 'string' && row.text.trim())
      .map(row => `${row.completed ? '☑' : '☐'} ${row.text}`);
    if (rows.length) parts.push(rows.join('\n'));
  }
  if (!parts.length) return null;
  const text = parts.join('\n\n');
  // SMS consumes body; other text receivers may consume text. Neither alias sends.
  return { action: 'ACTION_SEND', type: 'text/plain', data: { text, body: text } };
}
