import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ node: null as any, revision: 1, read: vi.fn(), listeners: new Set<() => void>() }));
vi.mock('../os/FileSystemService', () => ({ getNode: () => f.node, getFileContentToken: () => f.revision, readFile: () => f.read() }));
vi.mock('../os/TaskManager', () => ({ default: { subscribe(listener: () => void) { listener(); f.listeners.add(listener); return () => { f.listeners.delete(listener); }; } } }));
import { decodeNoteDocument, importNoteDocument, NOTE_IMPORT_MAX_BYTES, NoteImportError } from '../system/Notes/noteDocumentImport';
const bytes = (text: string) => new TextEncoder().encode(text);
const reference = { id: 'qa-document', path: '/sdcard/QA.txt', createdAt: 0 };
const notify = () => { for (const listener of f.listeners) listener(); };
beforeEach(() => {
  f.revision = 1; f.listeners.clear(); f.read.mockReset();
  f.node = { ...reference, name: 'QA.txt', type: 'file', parentId: 'sdcard', size: 5, mimeType: 'text/plain', modifiedAt: 0, storage: 'memory' };
  f.read.mockResolvedValue(new Blob(['hello'], { type: 'text/plain' }));
});
describe('Actual UTF-8 note-document conversion', () => {
  it.each([['QA.txt','text/plain'],['QA.MD','text/markdown'],['QA.markdown','text/x-markdown'],['QA.md','text/plain; charset=utf-8']])('supports %s with explicit text metadata', (name, mime) => {
    expect(decodeNoteDocument(name, mime, bytes('\ufeffA\r\n中文🧭\r\n\r\n B\r'), 'Imported')).toEqual({ title: 'QA', content: 'A\n中文🧭\n\n B\n' });
  });
  it('keeps literal percent/Unicode file names, whitespace, and empty explicitly selected documents', () => {
    expect(decodeNoteDocument('证据%2F.txt','text/plain',bytes('  A  '),'Imported')).toEqual({title:'证据%2F',content:'  A  '});
    expect(decodeNoteDocument('.txt','text/plain',bytes(''),'Imported')).toEqual({title:'Imported',content:''});
  });
  it.each([['doc.pdf','application/pdf'],['doc.html','text/html'],['doc.txt','application/octet-stream'],['doc.docx','text/plain']])('does not fake parsing unsupported %s', (name,mime) => {
    expect(() => decodeNoteDocument(name,mime,bytes('data'),'Imported')).toThrow(NoteImportError);
  });
  it.each([new Uint8Array([255,254]),bytes('text\0binary')])('refuses invalid UTF-8 or NUL payloads', value => {
    try { decodeNoteDocument('QA.txt','text/plain',value,'Imported'); throw Error('accepted invalid input'); }
    catch (error) { expect(error).toMatchObject({code:'encoding'}); }
  });
  it('checks the actual byte boundary without trimming or silent truncation', () => {
    expect(decodeNoteDocument('QA.txt','text/plain',new Uint8Array(NOTE_IMPORT_MAX_BYTES).fill(65),'Imported').content.length).toBe(NOTE_IMPORT_MAX_BYTES);
    expect(() => decodeNoteDocument('QA.txt','text/plain',new Uint8Array(NOTE_IMPORT_MAX_BYTES+1),'Imported')).toThrowError('size');
  });
});
describe('Source identity and foreground lease through publication', () => {
  it('reads actual bytes and keeps its listener until the synchronous commit finishes', async () => {
    const publish=vi.fn(text=>{ expect(text).toEqual({title:'QA',content:'hello'}); expect(f.listeners.size).toBe(1); });
    await importNoteDocument(reference,()=>true,new AbortController().signal,'Imported',publish);
    expect(publish).toHaveBeenCalledOnce(); expect(f.listeners.size).toBe(0);
  });
  it.each(['id','createdAt','path'])('rejects a mismatched %s before reading', async key => {
    const publish=vi.fn(); const wrong={...reference,[key]:key==='createdAt'?1:'wrong'};
    await expect(importNoteDocument(wrong as typeof reference,()=>true,new AbortController().signal,'Imported',publish)).rejects.toMatchObject({code:'unavailable'});
    expect(f.read).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
  });
  it('does not open an oversized source or flatten it to a truncated note', async () => {
    f.node.size=NOTE_IMPORT_MAX_BYTES+1;const publish=vi.fn();
    await expect(importNoteDocument(reference,()=>true,new AbortController().signal,'Imported',publish)).rejects.toMatchObject({code:'size'});
    expect(f.read).not.toHaveBeenCalled();expect(publish).not.toHaveBeenCalled();
  });
  it('checks actual Blob size even when metadata understates it', async () => {
    f.read.mockResolvedValue(new Blob([new Uint8Array(NOTE_IMPORT_MAX_BYTES+1)]));const publish=vi.fn();
    await expect(importNoteDocument(reference,()=>true,new AbortController().signal,'Imported',publish)).rejects.toMatchObject({code:'size'});
    expect(publish).not.toHaveBeenCalled();expect(f.listeners.size).toBe(0);
  });
  it.each(['replacement','revision','rename'])('rejects source %s while the read is pending, even with a frozen clock', async change => {
    let release!:(value:Blob)=>void;f.read.mockReturnValue(new Promise<Blob>(resolve=>{release=resolve;}));const publish=vi.fn();
    const job=importNoteDocument(reference,()=>true,new AbortController().signal,'Imported',publish);
    if(change==='replacement')f.node={...f.node};else if(change==='revision')f.revision++;else f.node.name='other.txt';
    release(new Blob(['hello']));await expect(job).rejects.toMatchObject({code:'changed'});
    expect(publish).not.toHaveBeenCalled();expect(f.listeners.size).toBe(0);
  });
  it('revokes a read permanently after leaving and returning before its bytes resolve', async () => {
    let active=true,release!:(value:Blob)=>void;f.read.mockReturnValue(new Promise<Blob>(resolve=>{release=resolve;}));const publish=vi.fn();
    const job=importNoteDocument(reference,()=>active,new AbortController().signal,'Imported',publish);
    const rejected=expect(job).rejects.toMatchObject({code:'cancelled'});
    active=false;notify();active=true;notify();release(new Blob(['hello']));await rejected;
    expect(publish).not.toHaveBeenCalled();expect(f.listeners.size).toBe(0);
  });
  it('cancels promptly on unmount/reset without waiting for unabortable storage IO', async () => {
    f.read.mockReturnValue(new Promise(()=>{}));const publish=vi.fn(),abort=new AbortController();
    const job=importNoteDocument(reference,()=>true,abort.signal,'Imported',publish);const rejected=expect(job).rejects.toMatchObject({code:'cancelled'});abort.abort();await rejected;
    expect(publish).not.toHaveBeenCalled();expect(f.listeners.size).toBe(0);
  });
  it('also guards asynchronous Blob conversion and cleans up after IO errors', async () => {
    let release!:(value:ArrayBuffer)=>void;
    const convert=vi.fn(()=>new Promise<ArrayBuffer>(resolve=>{release=resolve;}));f.read.mockResolvedValue({size:5,arrayBuffer:convert});const publish=vi.fn();
    const job=importNoteDocument(reference,()=>true,new AbortController().signal,'Imported',publish);
    await vi.waitFor(()=>expect(convert).toHaveBeenCalledOnce());f.revision++;release(bytes('hello').buffer as ArrayBuffer);
    await expect(job).rejects.toMatchObject({code:'changed'});expect(publish).not.toHaveBeenCalled();expect(f.listeners.size).toBe(0);
    f.read.mockRejectedValue(Error('IO failed'));
    await expect(importNoteDocument(reference,()=>true,new AbortController().signal,'Imported',publish)).rejects.toThrow('IO failed');
    expect(f.listeners.size).toBe(0);
  });
});
