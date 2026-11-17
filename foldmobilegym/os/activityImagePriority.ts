/** Browser resource hints only: never change image URLs, bytes, styles or app data. */
type ImageOwner = { original: string | null; assigned: string | null };
const owners = new WeakMap<HTMLImageElement, ImageOwner>();
const isAutomatic = (value: string | null) => value === null || value === '' || value.toLowerCase() === 'auto';

/** Actual clipped visibility also covers split panes and hidden persistent tabs. */
export function prioritizeVisibleActivityImages(root: HTMLElement): () => void {
  if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  const tracked = new Map<HTMLImageElement, ImageOwner>();
  let live = true;
  const forget = (image: HTMLImageElement, restore: boolean) => {
    const record = tracked.get(image);
    if (!record) return;
    tracked.delete(image);
    intersections.unobserve(image);
    if (owners.get(image) !== record) return; // Moved to a different Activity owner.
    owners.delete(image);
    if (restore && record.assigned !== null && image.getAttribute('fetchpriority') === record.assigned) {
      if (record.original === null) image.removeAttribute('fetchpriority');
      else image.setAttribute('fetchpriority', record.original);
    }
  };
  const intersections = new IntersectionObserver(entries => {
    if (!live) return;
    for (const entry of entries) {
      const image = entry.target as HTMLImageElement, record = tracked.get(image);
      if (!record || owners.get(image) !== record || !root.contains(image)) continue;
      const current = image.getAttribute('fetchpriority');
      if (current !== (record.assigned ?? record.original)) { forget(image, false); continue; }
      const visible = entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0
        && (typeof image.checkVisibility !== 'function' || image.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
      const priority = visible ? 'high' : 'auto';
      if (current !== priority) {
        record.assigned = priority;
        image.setAttribute('fetchpriority', priority);
      }
    }
  });
  const track = (image: HTMLImageElement) => {
    if (!root.contains(image)) return;
    const current = image.getAttribute('fetchpriority'), existing = tracked.get(image);
    if (existing) {
      if (owners.get(image) !== existing || current !== (existing.assigned ?? existing.original)) forget(image, false);
      return;
    }
    const previous = owners.get(image);
    const inherited = previous && current === (previous.assigned ?? previous.original) ? previous : null;
    const original = inherited ? inherited.original : current;
    if (!isAutomatic(original)) return; // Respect an App's explicit high/low policy.
    const record: ImageOwner = { original, assigned: inherited?.assigned ?? null };
    tracked.set(image, record); owners.set(image, record); intersections.observe(image);
  };
  const scan = (node: Node, removed = false) => {
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const update = (image: HTMLImageElement) => {
      if (removed) { if (!root.contains(image)) forget(image, true); }
      else track(image);
    };
    if (element.tagName === 'IMG') update(element as HTMLImageElement);
    element.querySelectorAll<HTMLImageElement>('img').forEach(update);
  };
  const mutations = new MutationObserver(records => {
    if (!live) return;
    for (const record of records) {
      if (record.type === 'attributes') scan(record.target);
      else {
        record.removedNodes.forEach(node => scan(node, true));
        record.addedNodes.forEach(node => scan(node));
      }
    }
  });
  mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'fetchpriority'] });
  scan(root);
  return () => {
    if (!live) return;
    live = false; mutations.disconnect(); intersections.disconnect();
    for (const image of tracked.keys()) forget(image, true);
  };
}
