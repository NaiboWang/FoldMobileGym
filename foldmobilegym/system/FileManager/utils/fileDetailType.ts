import type { FSNode } from '../../../os/types';

/** Display declared metadata, not a type guessed from the filename. */
export function getFileDetailType(
  file: Pick<FSNode, 'type' | 'mimeType'>,
  labels: { directory: string; unavailable: string },
): string {
  if (file.type === 'directory') return labels.directory;
  return (typeof file.mimeType === 'string' ? file.mimeType.trim() : '') || labels.unavailable;
}
