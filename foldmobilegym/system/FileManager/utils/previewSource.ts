import * as FileSystem from '../../../os/FileSystemService';
import type { FilePreviewSource } from './previewReader';

export function captureFilePreviewSource(path: string, expectedId?: string): FilePreviewSource {
  const node = path ? FileSystem.getNode(path) : null;
  const token = node ? FileSystem.getFileContentToken(node) : 0;
  const key = JSON.stringify(node ? [node.id, node.path, node.name, node.type, node.size, node.mimeType, node.storage, node.createdAt, node.modifiedAt, token] : [path, null]);
  return {
    key: expectedId === undefined ? key : JSON.stringify([key, expectedId]),
    file: node && (expectedId === undefined || node.id === expectedId) ? { ...node } : null,
    writing: token === null,
  };
}
