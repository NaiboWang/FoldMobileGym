/** Browser-owned Blob URLs are tied to a live node and its volatile content revision. */
export function createFileUriCache<Node extends { id: string; type: string }>(options: {
  lookup: (path: string) => Node | null;
  revision: (node: Node) => number | null;
  read: (path: string) => Promise<Blob | null>;
  create: (blob: Blob) => string;
  revoke: (url: string) => void;
}) {
  const entries = new Map<string, { node: Node; revision: number; url: string }>();
  let generation = 0;
  const clear = (id: string) => {
    const entry = entries.get(id);
    if (entry) { entries.delete(id); options.revoke(entry.url); }
  };
  const find = (node: Node, revision: number | null) => {
    if (revision === null) return null;
    const entry = entries.get(node.id);
    if (!entry) return null;
    if (entry.node === node && entry.revision === revision) return entry.url;
    clear(node.id);
    return null;
  };
  return {
    sync(path: string): string | null {
      const node = options.lookup(path);
      return node?.type === 'file' ? find(node, options.revision(node)) : null;
    },
    async resolve(path: string): Promise<string | null> {
      const node = options.lookup(path);
      if (!node || node.type !== 'file') return null;
      const revision = options.revision(node), requestGeneration = generation;
      if (revision === null) return null;
      const cached = find(node, revision);
      if (cached) return cached;
      const blob = await options.read(path);
      if (!blob || generation !== requestGeneration || options.lookup(path) !== node || options.revision(node) !== revision) return null;
      // Another caller may have published the same source while this read was pending.
      const published = find(node, revision);
      if (published) return published;
      const url = options.create(blob);
      entries.set(node.id, { node, revision, url });
      return url;
    },
    clear,
    clearAll() {
      generation++;
      for (const id of [...entries.keys()]) clear(id);
    },
  };
}
