import { createAppStore, registerStateAdapter } from '../../os/createAppStore';
import * as FileSystem from '../../os/FileSystemService';

export const useGalleryStore = createAppStore('gallery', {});

registerStateAdapter('gallery', (raw: Record<string, any>) => ({
  ...raw,
  media: FileSystem.getMediaFiles(),
  deleted_count: FileSystem.getDestructiveOperationCounts().deleted,
}));
