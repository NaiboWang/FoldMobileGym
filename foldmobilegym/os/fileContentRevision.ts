/** Volatile content evidence only: never persisted or included in filesystem/evaluator snapshots. */
const revisions = new WeakMap<object, { revision: number; writes: number }>();
let sequence = 0;
export function fileContentToken(node: object): number | null {
  const value = revisions.get(node);
  return value?.writes ? null : value?.revision ?? 0;
}
export function beginFileContentWrite(node: object) {
  revisions.set(node, { revision: ++sequence, writes: (revisions.get(node)?.writes ?? 0) + 1 });
}
export function endFileContentWrite(node: object) {
  revisions.set(node, { revision: ++sequence, writes: Math.max(0, (revisions.get(node)?.writes ?? 1) - 1) });
}
