/** Update only explicitly selected shelf records, retaining all other fields and order. */
export function setShelfPinned<T extends { bookId: string; isPinned?: boolean }>(items: T[], ids: readonly string[], pinned: boolean): T[] {
  const wanted = new Set(ids);
  let changed = false;
  const next = items.map(item => {
    if (!wanted.has(item.bookId) || (item.isPinned === true) === pinned) return item;
    changed = true;
    return { ...item, isPinned: pinned };
  });
  return changed ? next : items;
}
