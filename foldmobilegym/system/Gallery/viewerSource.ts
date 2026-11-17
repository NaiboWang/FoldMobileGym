import type { FSNode, MediaItem } from '../../os/types';

const IDENTITY_KEYS = ['id', 'path', 'name', 'type', 'size', 'mimeType', 'createdAt', 'modifiedAt', 'storage', 'thumbnailUri', 'width', 'height', 'duration'] as const;

/** A volatile lease on the file whose pixels were selected, never task/persistent data. */
export interface GallerySource {
  node: FSNode;
  metadata: FSNode;
  revision: number;
}

export function captureGallerySource(item: MediaItem, node: FSNode | null, revision: number | null): GallerySource | null {
  if (!node || node.type !== 'file' || revision === null || node.id !== item.id || node.path !== item.path
    || node.createdAt !== item.createdAt || node.size !== item.size || node.mimeType !== item.mimeType) return null;
  return { node, metadata: { ...node }, revision };
}

/** Object identity also protects a deleted/recreated file with coincident metadata. */
export function isGallerySourceCurrent(source: GallerySource | null, node: FSNode | null, revision: number | null): boolean {
  return !!source && !!node && node === source.node && revision !== null && revision === source.revision
    && IDENTITY_KEYS.every(key => node[key] === source.metadata[key]);
}
