import type { FSNode } from '@/os/types';
import type { IntentPayload } from '@/os/types/manifest';
import * as FileSystem from '@/os/FileSystemService';

export type TransferOperation = 'copy' | 'move';
export interface FileManagerShareSource { node: FSNode; metadata: FSNode; token: number | null }
export type FileManagerShareSources = ReadonlyMap<string, FileManagerShareSource>;
export type FileManagerShareOutcome = 'started' | 'ignored' | 'unsupported' | 'source-changed' | 'unavailable';
const SHARE_SOURCE_KEYS = ['id', 'path', 'name', 'parentId', 'type', 'size', 'mimeType', 'createdAt', 'modifiedAt', 'storage', 'thumbnailUri', 'width', 'height', 'duration'] as const;
const IMAGE_MIME = /^image\/[a-z0-9][a-z0-9.+_-]*$/i;

/** Capture with the displayed list, never renew an old selection on submit. */
export function captureFileManagerShareSources(
  nodes: readonly FSNode[], getToken: (node: FSNode) => number | null = FileSystem.getFileContentToken,
): FileManagerShareSources {
  return new Map(nodes.map(node => [node.id, { node, metadata: { ...node }, token: getToken(node) }]));
}

export async function transferNodesToDirectory(
  nodes: FSNode[],
  destPath: string,
  operation: TransferOperation,
): Promise<boolean> {
  if (nodes.length === 0) return false;

  try {
    // Validate the whole selection before any writes. copyFile overwrites and
    // createDirectory merges by design; the picker has no overwrite consent UI.
    const destination = FileSystem.getNode(destPath);
    if (!destination || destination.type !== 'directory') return false;
    const planned = [] as { node: FSNode; destPath: string }[];
    const destinations = new Set<string>();
    for (const selected of nodes) {
      const node = FileSystem.getNode(selected.path);
      if (!node || node.id !== selected.id) return false;
      const destNodePath = `${destination.path === '/' ? '' : destination.path}/${node.name}`;
      if (FileSystem.exists(destNodePath) || destinations.has(destNodePath)) return false;
      if (node.type === 'directory' &&
          (destination.path === node.path || destination.path.startsWith(`${node.path}/`))) return false;
      destinations.add(destNodePath);
      // moveNode mutates live nodes; freeze the source path for this operation.
      planned.push({ node: { ...node }, destPath: destNodePath });
    }
    // A selected ancestor and descendant cannot be moved independently.
    if (planned.some(({ node }) => planned.some(({ node: other }) =>
      node.id !== other.id && other.type === 'directory' && node.path.startsWith(`${other.path}/`)))) return false;

    for (const { node, destPath: destNodePath } of planned) {
      if (operation === 'move') {
        const moved = await FileSystem.moveNode(node.path, destNodePath);
        if (!moved) return false;
      } else {
        const copied = await copyNodeToPath(node, destNodePath);
        if (!copied) return false;
      }
    }
    return true;
  } catch (error) {
    console.error('[FileManager] Transfer failed:', error);
    return false;
  }
}

/**
 * Build the established ACTION_SEND image stream contract for the entire selection.
 * No non-image or missing member is silently omitted.
 *
 * 用 startActivity + newTask 走 fire-and-forget 语义（接收方如微信声明 launchMode='singleTask'
 * 时会留在自己 Task）。FileManager 不需要回执，与真机分享行为一致。
 */
export function createFileManagerImageShareIntent(
  nodes: readonly FSNode[], getNode: (path: string) => FSNode | null = FileSystem.getNode,
): IntentPayload | null {
  if (nodes.length === 0) return null;
  const liveNodes = nodes.map(selected => getNode(selected.path));
  if (liveNodes.some((live, index) => !live || live.type !== 'file' || live.id !== nodes[index].id
    || live.path !== nodes[index].path || live.mimeType !== nodes[index].mimeType
    || !IMAGE_MIME.test(live.mimeType ?? ''))) return null;
  const current = liveNodes as FSNode[];
  const types = current.map(node => node.mimeType!.toLowerCase());
  const family = types[0].split('/')[0];
  const mime = types.every(type => type === types[0]) ? types[0] : `${family}/*`;
  const streams = current.map(node => node.path);
  return {
    action: 'ACTION_SEND',
    type: mime,
    data: { stream: streams.length === 1 ? streams[0] : streams, mimeType: mime },
  };
}

export function shareNodesAsImages(
  ids: readonly string[], sources: FileManagerShareSources, owns: () => boolean,
  platform?: {
    getNode: (path: string) => FSNode | null;
    getToken: (node: FSNode) => number | null;
    startActivity?: (intent: IntentPayload, options: { newTask: boolean }) => boolean;
  },
): FileManagerShareOutcome {
  if (!owns() || !ids.length) return 'ignored';
  const access = platform ?? { getNode: FileSystem.getNode, getToken: FileSystem.getFileContentToken,
    startActivity: window.__OS__?.startActivity ? (intent: IntentPayload, options: { newTask: boolean }) => window.__OS__!.startActivity(intent, options) : undefined };
  const selected = [...new Set(ids)].map(id => sources.get(id));
  if (selected.some(source => !source)) return 'source-changed';
  const selection = selected as FileManagerShareSource[];
  if (selection.some(({ metadata }) => metadata.type !== 'file' || !IMAGE_MIME.test(metadata.mimeType ?? ''))) return 'unsupported';
  const current = () => selection.every(source => {
    const node = access.getNode(source.metadata.path);
    return node === source.node && source.token !== null && !!node && access.getToken(node) === source.token
      && SHARE_SOURCE_KEYS.every(key => node[key] === source.metadata[key]);
  });
  try {
    if (!current()) return owns() ? 'source-changed' : 'ignored';
    const intent = createFileManagerImageShareIntent(selection.map(source => source.node), access.getNode);
    if (!owns()) return 'ignored';
    if (!current()) return owns() ? 'source-changed' : 'ignored';
    if (!intent || !access.startActivity) return 'unavailable';
    // Synchronous boundary only: opening a chooser is not delivery or immutable bytes.
    if (!owns()) return 'ignored';
    return access.startActivity(intent, { newTask: true }) === true ? 'started' : 'unavailable';
  } catch {
    return owns() ? 'unavailable' : 'ignored';
  }
}

async function copyNodeToPath(node: FSNode, destPath: string): Promise<boolean> {
  if (node.type === 'file') {
    const copied = await FileSystem.copyFile(node.path, destPath);
    return Boolean(copied);
  }

  await FileSystem.createDirectory(destPath);
  const children = FileSystem.listDirectory(node.path);
  for (const child of children) {
    const copied = await copyNodeToPath(child, `${destPath}/${child.name}`);
    if (!copied) return false;
  }
  return true;
}
