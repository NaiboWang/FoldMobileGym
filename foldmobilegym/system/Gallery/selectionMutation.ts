import type { FSNode } from '../../os/types';
import { shareSourcesCurrent, type GalleryShareSources } from './shareOwnership';

export type GalleryMutationStatus = 'completed' | 'ignored' | 'source-changed' | 'unavailable' | 'interrupted';
export interface GalleryMutationResult {
  status: GalleryMutationStatus;
  completed: string[];
}
export interface GalleryMutationGate { busy: boolean }
interface SourceAccess {
  getNode: (path: string) => FSNode | null;
  getToken: (node: FSNode) => number | null;
}

/** Validate the displayed versions, never recapture a stale selection on submit. */
export function galleryMutationReadiness(
  paths: readonly string[], owns: () => boolean, sources: GalleryShareSources, access: SourceAccess,
): 'ready' | 'ignored' | 'source-changed' {
  if (!owns() || paths.length === 0) return 'ignored';
  const current = shareSourcesCurrent(paths, sources, access.getNode, access.getToken);
  if (!owns()) return 'ignored';
  return current ? 'ready' : 'source-changed';
}

/** Reject the whole stale selection before its first write; report only real completions. */
export async function mutateGallerySelection(
  paths: readonly string[], owns: () => boolean, sources: GalleryShareSources,
  gate: GalleryMutationGate, access: SourceAccess & { mutate: (path: string) => boolean | Promise<boolean> },
): Promise<GalleryMutationResult> {
  const completed: string[] = [];
  if (gate.busy) return { status: 'ignored', completed };
  const selection = [...new Set(paths)];
  const readiness = galleryMutationReadiness(selection, owns, sources, access);
  if (readiness !== 'ready') return { status: readiness, completed };
  gate.busy = true;
  try {
    for (const path of selection) {
      const current = galleryMutationReadiness([path], owns, sources, access);
      if (current !== 'ready') return { status: current === 'ignored' ? 'interrupted' : current, completed };
      try {
        if (await access.mutate(path) !== true) return { status: 'unavailable', completed };
      } catch {
        return { status: 'unavailable', completed };
      }
      completed.push(path);
    }
    return { status: owns() ? 'completed' : 'interrupted', completed };
  } finally {
    gate.busy = false;
  }
}
