import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from '../../../os/FileSystemService';
import { AppLifecycle } from '../../../os/AppLifecycle';
import { createFilePreviewReader, type FilePreviewSnapshot } from '../utils/previewReader';
import { captureFilePreviewSource } from '../utils/previewSource';

const plainText = (text: string) => text;

export function useFilePreview(path: string, decode: (text: string) => string | null = plainText) {
  const readSource = useCallback(() => captureFilePreviewSource(path), [path]);
  const [snapshot, setSnapshot] = useState<FilePreviewSnapshot>(() => ({ ...readSource(), status: 'loading', text: '' }));
  useEffect(() => {
    const reader = createFilePreviewReader({ source: readSource, read: FileSystem.readFile, decode, publish: setSnapshot });
    reader.refresh();
    // FileSystemService has no general mutation subscription; only metadata/token checks poll.
    // Unchanged sources never reread bytes or update React state.
    const timer = window.setInterval(reader.refresh, 250);
    const unsubscribe = AppLifecycle.subscribe('file_manager', event => { if (event === 'foreground') reader.refresh(); });
    return () => { window.clearInterval(timer); unsubscribe(); reader.dispose(); };
  }, [readSource, decode]);
  const source = readSource();
  // A changed path/source must not paint the previous file while its next effect starts.
  const visible: FilePreviewSnapshot = snapshot.key === source.key ? snapshot
    : { ...source, status: source.file?.type === 'file' ? 'loading' : 'error', text: '' };
  return { file: visible.file, state: visible };
}
