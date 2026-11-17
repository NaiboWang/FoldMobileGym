import type { FSNode } from '../../../os/types';
import { isPdfPreviewableFile, isTextPreviewableFile } from './fileUtils';

export type FileSearchCategory = 'all' | 'images' | 'videos' | 'documents' | 'audio' | 'archives' | 'packages' | 'apps';
export const normalizeSearchCategory = (value: string | null): FileSearchCategory =>
  value === 'images' || value === 'videos' || value === 'documents' || value === 'audio' || value === 'archives' || value === 'packages' || value === 'apps' ? value : 'all';

/** Use exactly the filename filter's literal/trimmed case folding, without HTML
 * or regular expressions. Map expanded lowercase characters back to the source. */
export function fileSearchNameParts(name: string, query: string): { text: string; match: boolean }[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [{ text: name, match: false }];
  const folded = name.toLocaleLowerCase();
  const offsets: { start: number; end: number }[] = [];
  let sourceOffset = 0;
  for (const char of name) {
    for (let i = 0; i < char.toLocaleLowerCase().length; i++) offsets.push({ start: sourceOffset, end: sourceOffset + char.length });
    sourceOffset += char.length;
  }
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0, next = 0;
  while (next < folded.length) {
    const found = folded.indexOf(needle, next);
    if (found < 0) break;
    const start = offsets[found].start, end = offsets[found + needle.length - 1].end;
    if (start >= cursor) {
      if (start > cursor) parts.push({ text: name.slice(cursor, start), match: false });
      parts.push({ text: name.slice(start, end), match: true });
      cursor = end;
    }
    next = found + needle.length;
  }
  if (cursor < name.length) parts.push({ text: name.slice(cursor), match: false });
  return parts;
}

// Do not treat every application/* binary as a document. Keep known office
// formats discoverable even when the filesystem provides a generic MIME type.
const DOCUMENT_EXTENSIONS = /\.(?:txt|log|md|csv|json|xml|html?|pdf|rtf|docx?|xlsx?|pptx?|odt|ods|odp|epub)$/i;
const DOCUMENT_MIMES = new Set([
  'application/pdf', 'application/json', 'application/xml', 'application/rtf', 'application/epub+zip',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);
const isArchive = (file: FSNode, mime: string) => mime === 'application/zip' || mime === 'application/x-rar-compressed'
  || mime === 'application/x-7z-compressed' || mime === 'application/gzip' || /\.(zip|rar|7z|tar|gz)$/i.test(file.name);
const isPackage = (file: FSNode, mime: string) => mime === 'application/vnd.android.package-archive'
  || /\.(apk|xapk)$/i.test(file.name);

export function filterSearchFiles(files: FSNode[], query: string, category: FileSearchCategory): FSNode[] {
  const needle = query.trim().toLocaleLowerCase();
  return files.filter(file => {
    if (file.type !== 'file' || !file.name.toLocaleLowerCase().includes(needle)) return false;
    const mime = (file.mimeType || '').split(';', 1)[0].trim().toLowerCase();
    if (category === 'images') return mime.startsWith('image/');
    if (category === 'videos') return mime.startsWith('video/');
    if (category === 'audio') return mime.startsWith('audio/');
    if (category === 'archives') return isArchive(file, mime);
    if (category === 'packages') return isPackage(file, mime);
    if (category === 'apps') return false;
    if (category === 'documents') return !isArchive(file, mime) && !isPackage(file, mime)
      && (mime.startsWith('text/') || DOCUMENT_MIMES.has(mime) || DOCUMENT_EXTENSIONS.test(file.name));
    return true;
  }).sort((a, b) => b.modifiedAt - a.modifiedAt || a.path.localeCompare(b.path));
}

/** Unsupported binaries open their containing folder, never an invented preview. */
export function searchFileDestination(file: FSNode) {
  if (isTextPreviewableFile(file)) return { kind: 'text' as const, path: file.path };
  if (isPdfPreviewableFile(file)) return { kind: 'pdf' as const, path: file.path };
  return { kind: 'folder' as const, path: file.path.slice(0, file.path.lastIndexOf('/')) || '/' };
}
