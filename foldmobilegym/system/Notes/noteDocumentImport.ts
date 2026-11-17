import * as FileSystem from '../../os/FileSystemService';
import TaskManager from '../../os/TaskManager';
import type { DocumentReference } from '../../os/utils/documentReference';
import { matchesDocumentReference } from '../../os/utils/documentReference';

export const NOTE_IMPORT_MAX_BYTES = 1024 * 1024;
export type NoteImportFailure = 'unsupported' | 'size' | 'encoding' | 'changed' | 'unavailable' | 'cancelled';
export class NoteImportError extends Error {
  constructor(public readonly code: NoteImportFailure) { super(code); }
}
export interface ImportedNoteText { title: string; content: string }
const supported = (name: string, mime: string | undefined) => /\.(txt|md|markdown)$/i.test(name)
  && ['text/plain', 'text/markdown', 'text/x-markdown'].includes((mime ?? '').split(';')[0].trim().toLowerCase());

/** Text copy only: no HTML execution, rich-document parsing or original-file write. */
export function decodeNoteDocument(name: string, mime: string | undefined, bytes: Uint8Array, fallbackTitle: string): ImportedNoteText {
  if (!supported(name, mime)) throw new NoteImportError('unsupported');
  if (bytes.byteLength > NOTE_IMPORT_MAX_BYTES) throw new NoteImportError('size');
  let content: string;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new NoteImportError('encoding'); }
  if (content.includes('\0')) throw new NoteImportError('encoding');
  const stem = name.replace(/\.(txt|md|markdown)$/i, '');
  return { title: stem.trim() ? stem : fallbackTitle, content: content.replace(/\r\n?/g, '\n') };
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new NoteImportError('cancelled')); };
    signal.addEventListener('abort', abort, { once: true });
    operation.then(value => { signal.removeEventListener('abort', abort); resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(error); });
    if (signal.aborted) abort();
  });
}

/** Keep ownership through the synchronous publication, not just through decoding. */
export async function importNoteDocument(reference: DocumentReference, owns: () => boolean,
  signal: AbortSignal, fallbackTitle: string, publish: (text: ImportedNoteText) => void): Promise<void> {
  if (!owns() || signal.aborted) throw new NoteImportError('cancelled');
  const node = FileSystem.getNode(reference.path);
  if (!matchesDocumentReference(reference, node)) throw new NoteImportError('unavailable');
  if (!supported(node.name, node.mimeType)) throw new NoteImportError('unsupported');
  if (node.size > NOTE_IMPORT_MAX_BYTES) throw new NoteImportError('size');
  const revision = FileSystem.getFileContentToken(node), metadata = { ...node };
  if (revision === null) throw new NoteImportError('unavailable');
  const current = () => FileSystem.getNode(reference.path) === node && FileSystem.getFileContentToken(node) === revision
    && (['id', 'path', 'name', 'type', 'parentId', 'size', 'mimeType', 'createdAt', 'modifiedAt', 'storage'] as const).every(key => node[key] === metadata[key]);
  const read = new AbortController();
  const cancel = () => read.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const unsubscribe = TaskManager.subscribe(() => { if (!owns()) cancel(); });
  const check = () => {
    if (!owns() || read.signal.aborted || signal.aborted) throw new NoteImportError('cancelled');
    if (!current()) throw new NoteImportError('changed');
  };
  try {
    check();
    const blob = await abortable(FileSystem.readFile(reference.path), read.signal);
    check();
    if (!blob) throw new NoteImportError('unavailable');
    if (blob.size > NOTE_IMPORT_MAX_BYTES) throw new NoteImportError('size');
    const bytes = await abortable(blob.arrayBuffer(), read.signal);
    check();
    const result = decodeNoteDocument(metadata.name, metadata.mimeType, new Uint8Array(bytes), fallbackTitle);
    check();
    publish(result);
  } finally { unsubscribe(); signal.removeEventListener('abort', cancel); }
}
