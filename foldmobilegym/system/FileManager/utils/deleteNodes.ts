import type { FSNode } from '@/os/types';
import * as FileSystem from '@/os/FileSystemService';

export interface DeleteResult { deleted: FSNode[]; failed: FSNode[]; changed: FSNode[] }

/** Delete only the identities confirmed by the user, reporting top-level items. */
export async function deleteNodes(targets: readonly FSNode[]): Promise<DeleteResult> {
  const result: DeleteResult = { deleted: [], failed: [], changed: [] };
  const visited = new Set<string>();
  for (const target of targets) {
    if (visited.has(target.id)) continue;
    visited.add(target.id);
    try {
      if (FileSystem.getNode(target.path)?.id !== target.id) {
        result.changed.push(target);
        continue;
      }
      if (await FileSystem.deleteNode(target.path)) result.deleted.push(target);
      else result.failed.push(target);
    } catch {
      result.failed.push(target);
    }
  }
  return result;
}
