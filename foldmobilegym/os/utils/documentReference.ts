import { matchesIntentMime } from './intentMime';
import type { FSNode } from '../types';

/** A reference into the simulator's shared storage, never a host path or blob URL. */
export interface DocumentReference { id: string; path: string; createdAt: number }
export function isSharedDocumentPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/sdcard/') && !value.includes('\u0000')
    && !value.includes('\\') && value.split('/').every(part => part !== '.' && part !== '..');
}
export function documentReference(node: FSNode): DocumentReference | null {
  return node.type === 'file' && isSharedDocumentPath(node.path)
    ? { id: node.id, path: node.path, createdAt: node.createdAt } : null;
}
export function isDocumentReference(value: unknown): value is DocumentReference {
  if (!value || typeof value !== 'object') return false;
  const ref = value as DocumentReference;
  return typeof ref.id === 'string' && ref.id.length > 0 && isSharedDocumentPath(ref.path)
    && Number.isFinite(ref.createdAt);
}
export function matchesDocumentReference(reference: DocumentReference, node: FSNode | null): node is FSNode {
  return isDocumentReference(reference) && !!node && node.type === 'file'
    && node.id === reference.id && node.path === reference.path && node.createdAt === reference.createdAt;
}
export function matchesDocumentMime(node: FSNode, requested: string | undefined): boolean {
  if (node.type !== 'file') return false;
  const filter = requested?.trim().toLowerCase() || '*/*';
  const actual = node.mimeType?.toLowerCase() || 'application/octet-stream';
  return matchesIntentMime(filter, actual);
}
