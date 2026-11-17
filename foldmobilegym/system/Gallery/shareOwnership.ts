import type { FSNode, MediaItem } from '../../os/types';
import type { IntentPayload } from '../../os/types/manifest';
import { captureGallerySource, isGallerySourceCurrent, type GallerySource } from './viewerSource';

type GetNode = (path: string) => FSNode | null;
type GetContentToken = (node: FSNode) => number | null;
export type GalleryShareSources = ReadonlyMap<string, GallerySource | null>;
export type GalleryShareOutcome = 'started' | 'ignored' | 'source-changed' | 'unavailable';

/** Capture once when the displayed list is loaded, not when Share is pressed. */
export function captureShareSources(items: readonly MediaItem[], getNode: GetNode, getToken: GetContentToken): GalleryShareSources {
  return new Map(items.map(item => {
    const node = getNode(item.path);
    return [item.path, captureGallerySource(item, node, node ? getToken(node) : null)] as const;
  }));
}

/** All selected versions must still exist; never renew a lease or drop an item. */
export function shareSourcesCurrent(paths: readonly string[], sources: GalleryShareSources, getNode: GetNode, getToken: GetContentToken): boolean {
  return paths.length > 0 && paths.every(path => {
    const node = getNode(path);
    return isGallerySourceCurrent(sources.get(path) ?? null, node, node ? getToken(node) : null);
  });
}

function resolveShareNodes(paths: readonly string[], owns: () => boolean, getNode: GetNode): FSNode[] {
  if (!owns() || paths.length === 0 || paths.some(path => typeof path !== 'string' || !path)) return [];
  const nodes: FSNode[] = [];
  for (const path of new Set(paths)) {
    const node = getNode(path);
    if (!node || node.path !== path || node.type !== 'file' || typeof node.mimeType !== 'string'
      || !/^(image|video)\/[a-z0-9.+_-]+$/i.test(node.mimeType)) return [];
    nodes.push(node);
  }
  return owns() ? nodes : [];
}

/** Atomic media selection: never silently share a subset after a source disappears. */
export function resolveGallerySharePaths(paths: readonly string[], owns: () => boolean, getNode: GetNode): string[] {
  return resolveShareNodes(paths, owns, getNode).map(node => node.path);
}

export function createGalleryShareIntent(paths: readonly string[], owns: () => boolean, getNode: GetNode): IntentPayload | null {
  const nodes = resolveShareNodes(paths, owns, getNode);
  if (!nodes.length) return null;
  const types = nodes.map(node => node.mimeType!.toLowerCase());
  const family = types[0].split('/')[0];
  const mime = types.every(type => type === types[0]) ? types[0]
    : types.every(type => type.split('/')[0] === family) ? `${family}/*` : '*/*';
  const streams = nodes.map(node => node.path);
  if (!owns()) return null;
  // Preserve ACTION_SEND, a single stream string / multiple stream array, and actual MIME.
  return { action: 'ACTION_SEND', type: mime, data: { stream: streams.length === 1 ? streams[0] : streams, mimeType: mime } };
}

/** Only dispatch an explicitly owned, all-current selection. "started" is not delivery. */
export function sendGalleryShare(
  paths: readonly string[],
  owns: () => boolean,
  sources: GalleryShareSources,
  platform: {
    getNode: GetNode;
    getToken: GetContentToken;
    startActivity?: (intent: IntentPayload, options: { newTask: boolean }) => boolean;
  },
): GalleryShareOutcome {
  if (!owns() || paths.length === 0) return 'ignored';
  const selection = [...paths];
  const current = () => shareSourcesCurrent(selection, sources, platform.getNode, platform.getToken);
  if (!current()) return owns() ? 'source-changed' : 'ignored';
  const intent = createGalleryShareIntent(selection, () => owns() && current(), platform.getNode);
  if (!owns()) return 'ignored';
  if (!current()) return owns() ? 'source-changed' : 'ignored';
  if (!intent || !platform.startActivity) return 'unavailable';
  // No await between the final source/Activity checks and the established handoff.
  if (!owns()) return 'ignored';
  try {
    return platform.startActivity(intent, { newTask: true }) === true ? 'started' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
