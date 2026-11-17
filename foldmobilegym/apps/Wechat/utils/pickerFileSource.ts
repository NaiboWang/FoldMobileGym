import * as FileSystem from '../../../os/FileSystemService';
import type { FSNode } from '../../../os/types';
const KEYS = ['id','path','name','type','size','mimeType','createdAt','modifiedAt','storage'] as const;
export type PickerFileIdentity = { node: FSNode; meta: FSNode; revision: number };
export type PickerFileSource = PickerFileIdentity & { ready: Promise<string | null>; image: boolean };
export function sourceIsCurrent(source: Pick<PickerFileSource,'node'|'meta'|'revision'>): boolean {
  const current = FileSystem.getNode(source.meta.path);
  return current === source.node && FileSystem.getFileContentToken(current) === source.revision
    && KEYS.every(key => current[key] === source.meta[key]);
}
async function digest(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}
async function imageDecodes(blob: Blob): Promise<boolean> {
  const uri = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = uri;
    await image.decode(); return image.naturalWidth > 0 && image.naturalHeight > 0;
  } catch { return false; } finally { URL.revokeObjectURL(uri); }
}
async function readDigest(source: Omit<PickerFileSource,'ready'>): Promise<string | null> {
  if (!sourceIsCurrent(source)) return null;
  try {
    const blob = await FileSystem.readFile(source.meta.path);
    if (!blob || blob.size !== source.meta.size || !sourceIsCurrent(source)) return null;
    if (source.image && (!source.meta.mimeType?.startsWith('image/') || !await imageDecodes(blob))) return null;
    const result = await digest(blob);
    return sourceIsCurrent(source) ? result : null;
  } catch { return null; }
}
export function capturePickerIdentity(path: string, expectedId?: string): PickerFileIdentity | null {
  const node = FileSystem.getNode(path);
  if (!node || node.type !== 'file' || (expectedId !== undefined && node.id !== expectedId)) return null;
  const revision = FileSystem.getFileContentToken(node);
  return revision === null ? null : {node,meta:{...node},revision};
}
export function capturePickerFile(path: string, image: boolean, expectedId?: string, visible?: PickerFileIdentity | null): PickerFileSource | null {
  if (visible !== undefined && (!visible || !sourceIsCurrent(visible))) return null;
  const identity = visible ?? capturePickerIdentity(path,expectedId);
  if (!identity || identity.meta.path !== path || (expectedId !== undefined && identity.meta.id !== expectedId)) return null;
  const captured = { ...identity, image };
  return { ...captured, ready: readDigest(captured) };
}

/** No partial commit. Re-read real bytes and recheck every source after all asynchronous work. */
export async function validatePickerFiles(sources: readonly PickerFileSource[]): Promise<boolean> {
  if (!sources.length) return false;
  const results = await Promise.all(sources.map(async source => {
    const original = await source.ready;
    return original !== null && sourceIsCurrent(source) && await readDigest(source) === original;
  }));
  return results.every(Boolean) && sources.every(sourceIsCurrent);
}
