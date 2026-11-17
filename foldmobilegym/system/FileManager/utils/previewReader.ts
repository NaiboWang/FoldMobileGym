import type { FSNode } from '../../../os/types';
export interface FilePreviewSource { key: string; file: FSNode | null; writing: boolean }
export interface FilePreviewSnapshot extends FilePreviewSource { status: 'loading' | 'ready' | 'error'; text: string }

/** Async reads belong to an exact source revision, not just to a pathname. */
export function createFilePreviewReader(options: {
  source: () => FilePreviewSource;
  read: (path: string) => Promise<Blob | null>;
  decode: (text: string) => string | null;
  publish: (snapshot: FilePreviewSnapshot) => void;
}) {
  let alive = true, sequence = 0, key: string | undefined;
  const refresh = () => {
    if (!alive) return;
    const source = options.source();
    if (key === source.key) return;
    key = source.key;
    const request = ++sequence;
    const current = () => alive && sequence === request && options.source().key === source.key;
    const recover = () => { if (alive && sequence === request) refresh(); };
    const publish = (status: FilePreviewSnapshot['status'], text = '') => options.publish({ ...source, status, text });
    if (!source.file || source.file.type !== 'file') { publish('error'); return; }
    publish('loading');
    if (source.writing) return;
    const path = source.file.path;
    void (async () => {
      try {
        const blob = await options.read(path);
        if (!current()) { recover(); return; }
        if (!blob) { publish('error'); return; }
        const raw = await blob.text();
        if (!current()) { recover(); return; }
        const text = options.decode(raw);
        if (!current()) { recover(); return; }
        publish(text === null ? 'error' : 'ready', text ?? '');
      } catch {
        if (current()) publish('error');
        else recover();
      }
    })();
  };
  return { refresh, dispose() { alive = false; sequence++; } };
}
