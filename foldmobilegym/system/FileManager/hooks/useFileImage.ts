import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from '../../../os/FileSystemService';
import { AppLifecycle } from '../../../os/AppLifecycle';
import { captureFilePreviewSource } from '../utils/previewSource';
import { createFileImageReader, type FileImageSnapshot } from '../utils/imageReader';

export function useFileImage(path: string, nodeId?: string) {
  const readSource = useCallback(() => captureFilePreviewSource(path, nodeId), [path, nodeId]);
  const reader = useRef<ReturnType<typeof createFileImageReader> | null>(null);
  const [snapshot, setSnapshot] = useState<FileImageSnapshot>(() => ({ ...readSource(), status: 'loading', uri: null }));
  useEffect(() => {
    const current = createFileImageReader({ source: readSource, resolve: async path => FileSystem.getFileUri(path) ?? await FileSystem.getFileUriAsync(path), publish: setSnapshot });
    reader.current = current;
    current.refresh();
    const timer = window.setInterval(() => current.refresh(), 250);
    const unsubscribe = AppLifecycle.subscribe('file_manager', event => { if (event === 'foreground') current.retry(); });
    return () => { window.clearInterval(timer); unsubscribe(); current.dispose(); if (reader.current === current) reader.current = null; };
  }, [readSource]);
  const reportImage = useCallback((key: string, uri: string, decoded: boolean) => reader.current?.imageResult(key, uri, decoded), []);
  const source = readSource();
  const visible: FileImageSnapshot = snapshot.key === source.key ? snapshot
    : { ...source, status: source.file?.type === 'file' ? 'loading' : 'error', uri: null };
  return { image: visible, reportImage };
}
