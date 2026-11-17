import type { FilePreviewSource } from './previewReader';
export interface FileImageSnapshot extends FilePreviewSource { status: 'loading' | 'ready' | 'error'; uri: string | null }

/** URI ownership and decoded-pixel ownership are validated separately. URLs belong to FileSystemService. */
export function createFileImageReader(options: {
  source: () => FilePreviewSource;
  resolve: (path: string) => Promise<string | null>;
  publish: (snapshot: FileImageSnapshot) => void;
}) {
  let alive = true, sequence = 0, key: string | undefined, uri: string | null = null;
  let source: FilePreviewSource | null = null;
  let status: FileImageSnapshot['status'] = 'loading';
  const publish = (next: FileImageSnapshot['status'], nextUri: string | null = null) => {
    status = next; uri = nextUri;
    if (source) options.publish({ ...source, status, uri });
  };
  const refresh = (force = false) => {
    if (!alive) return;
    const next = options.source();
    if (!force && next.key === key) return;
    source = next; key = next.key;
    const request = ++sequence;
    const current = () => alive && sequence === request && options.source().key === next.key;
    const recover = () => { if (alive && sequence === request) refresh(); };
    if (!next.file || next.file.type !== 'file') { publish('error'); return; }
    publish('loading');
    if (next.writing) return;
    const path = next.file.path;
    void (async () => {
      try {
        const result = await options.resolve(path);
        if (!current()) { recover(); return; }
        publish(result ? 'loading' : 'error', result || null);
      } catch {
        if (current()) publish('error');
        else recover();
      }
    })();
  };
  return {
    refresh,
    retry() { refresh(status === 'error'); },
    imageResult(sourceKey: string, imageUri: string, decoded: boolean) {
      if (!alive || sourceKey !== key || imageUri !== uri) return;
      if (options.source().key !== key) { refresh(); return; }
      if (decoded) { if (status !== 'ready') publish('ready', imageUri); }
      else publish('error');
    },
    dispose() { alive = false; sequence++; uri = null; source = null; },
  };
}
