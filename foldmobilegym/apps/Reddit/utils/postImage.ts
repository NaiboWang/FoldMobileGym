import * as FileSystem from '../../../os/FileSystemService';
import type { MediaItem } from '../../../os/types';

// Persist source identity, not a session-only blob URL or image byte copies.
const PREFIX = 'simfs-image:';
export const isVirtualPostImage = (source: string) => source.startsWith(PREFIX);
export function virtualPostImageId(source: string): string | null {
  if (!isVirtualPostImage(source)) return null;
  try { return decodeURIComponent(source.slice(PREFIX.length)) || null; } catch { return null; }
}
export async function resolveVirtualPostImage(source: string): Promise<string | null> {
  const id = virtualPostImageId(source);
  if (!id) return null;
  await FileSystem.initFileSystem();
  const found = FileSystem.getMediaFiles('image').find(file => file.id === id);
  if (!found) return null;
  // Filesystem metadata is mutable in place; retain values, not its live object.
  const node = { ...found };
  const bytes = await FileSystem.readFile(node.path);
  const current = FileSystem.getMediaFiles('image').find(file => file.id === id);
  return bytes && current?.path === node.path && current.size === node.size && current.modifiedAt === node.modifiedAt
    ? URL.createObjectURL(bytes) : null;
}

function decodeImage(uri: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image(); let done = false;
    const finish = (success: boolean) => {
      if (done) return; done = true; clearTimeout(timer);
      image.onload = null; image.onerror = null; image.removeAttribute('src'); resolve(success);
    };
    const timer = setTimeout(() => finish(false), 8000);
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => finish(false); image.src = uri;
  });
}

/** Only accept decodable bytes from the exact identity selected by the picker. */
export async function pickedPostImage(item: MediaItem): Promise<string | null> {
  if (item.type !== 'image' || !item.id) return null;
  const source = PREFIX + encodeURIComponent(item.id);
  const found = FileSystem.getNode(item.path);
  if (found?.id !== item.id || found.type !== 'file' || !found.mimeType?.startsWith('image/')) return null;
  const node = { ...found };
  const uri = await resolveVirtualPostImage(source);
  if (!uri) return null;
  try {
    if (!await decodeImage(uri)) return null;
    const current = FileSystem.getNode(item.path);
    return current?.id === node.id && current.modifiedAt === node.modifiedAt && current.size === node.size ? source : null;
  } finally { URL.revokeObjectURL(uri); }
}
