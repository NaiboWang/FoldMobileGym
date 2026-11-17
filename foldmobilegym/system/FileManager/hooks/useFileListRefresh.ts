import { useEffect, useRef } from 'react';
import type { FSNode } from '../../../os/types';
import * as FileSystem from '../../../os/FileSystemService';
import { AppLifecycle } from '../../../os/AppLifecycle';
import { captureFileListObservation, createFileListObserver } from '../utils/fileListObserver';

export function useFileListRefresh(read: () => FSNode[], refresh: () => void, active: () => boolean) {
  const latest = useRef({ read, refresh, active });
  latest.current = { read, refresh, active };
  useEffect(() => {
    const observer = createFileListObserver({
      active: () => latest.current.active(),
      read: () => captureFileListObservation(latest.current.read(), FileSystem.getFileContentToken,
        path => FileSystem.listDirectory(path).length),
      refresh: () => latest.current.refresh(),
    });
    observer.poll();
    const timer = window.setInterval(() => observer.poll(), 250);
    const unsubscribe = AppLifecycle.subscribe('file_manager', event => { if (event === 'foreground') observer.poll(); });
    return () => { window.clearInterval(timer); unsubscribe(); observer.dispose(); };
  }, []);
}
