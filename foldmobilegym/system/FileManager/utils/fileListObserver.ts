import type { FSNode } from '../../../os/types';

export interface FileListObservation { nodes: readonly FSNode[]; key: string }

/** Metadata/content evidence only. No file-byte reads or writes are performed. */
export function captureFileListObservation(
  nodes: readonly FSNode[],
  token: (node: FSNode) => number | null,
  childCount: (path: string) => number,
): FileListObservation {
  return { nodes: [...nodes], key: JSON.stringify(nodes.map(node => [node,
    node.type === 'file' ? token(node) : childCount(node.path)])) };
}

/** Never renew an interaction snapshot while selection/dialog/background ownership blocks it. */
export function createFileListObserver(options: {
  active: () => boolean;
  read: () => FileListObservation;
  refresh: () => void;
}) {
  let alive = true;
  let previous: FileListObservation | undefined;
  return {
    poll() {
      if (!alive || !options.active()) return;
      const current = options.read();
      if (previous && current.key === previous.key && current.nodes.length === previous.nodes.length
        && current.nodes.every((node, index) => node === previous!.nodes[index])) return;
      previous = current;
      options.refresh();
    },
    dispose() { alive = false; previous = undefined; },
  };
}
