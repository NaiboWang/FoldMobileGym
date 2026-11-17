type Dict = Record<string, any>;

export function compareRecoveredForm(before: Array<{ key: string; value: string }>, after: Array<{ key: string; value: string }>) {
  const uniqueBefore = new Set(before.map(field => field.key)).size === before.length;
  const matches = before.map(field => ({ field, recovered: after.filter(item => item.key === field.key) }));
  const fieldsPreserved = uniqueBefore && matches.every(({ recovered }) => recovered.length === 1);
  const valuesPreserved = fieldsPreserved && matches.every(({ field, recovered }) => recovered[0].value === field.value);
  return { fieldsPreserved, valuesPreserved };
}

// Only authored text can establish draft progress without an explicit UI
// interaction. IDs, timestamps, default toggles and selectors are context.
const TEXT_FIELDS = new Set(['title', 'notes', 'location', 'text', 'content', 'body', 'subject', 'to', 'name', 'description']);

export function hasDraftEntryProgress(app: Dict, initial: Dict = {}): boolean {
  const changedText = (value: unknown, previous: unknown) =>
    typeof value === 'string' && value.trim().length > 0 && value !== previous;
  const plural = Object.entries(app.drafts || {}).some(([id, draft]: [string, any]) =>
    changedText(draft?.text, initial.drafts?.[id]?.text));
  const singular = app.draft && typeof app.draft === 'object'
    && Object.entries(app.draft).some(([key, value]) =>
      TEXT_FIELDS.has(key) && changedText(value, initial.draft?.[key]));
  return Boolean(plural || singular);
}

// A cart is an editable target, not a text draft or a committed order. Merely
// selecting a shop (or retaining an initial cart) cannot establish entry.
export function hasCartEntryProgress(app: Dict, initial: Dict = {}): boolean {
  const cart = app.cart;
  if (!cart || typeof cart.shopId !== 'string' || !cart.shopId) return false;
  const previous = initial.cart?.shopId === cart.shopId ? initial.cart.quantities || {} : {};
  return Object.entries(cart.quantities || {}).some(([id, quantity]) =>
    id.length > 0 && typeof quantity === 'number' && Number.isSafeInteger(quantity)
    && quantity > 0 && quantity !== (previous[id] ?? 0));
}

export function targetAppIds(appIds: string[], recoveryAppId?: string): string[] {
  return recoveryAppId ? [recoveryAppId] : appIds.length > 1 ? appIds.slice(1) : appIds;
}

export function isExpectedShopRoute(route: string, expectedIds: string[], catalogIds: string[]): boolean {
  const match = /^\/shop\/([^/?#]+)(?:\/(?:reviews|info))?(?:[?#].*)?$/.exec(route);
  if (!match) return false;
  let id: string;
  try { id = decodeURIComponent(match[1]); } catch { return false; }
  return expectedIds.includes(id) && catalogIds.includes(id);
}

export function countBusinessCommits(apps: Dict): number {
  return Object.values(apps).reduce((total: number, app: any) => {
    const created = Number(app?.created_count || 0);
    // Legacy draft presence flags remain for v2 compatibility, not proof of
    // precise save counts. New task judges must use explicit business diffs.
    const saves = Object.values(app?.drafts || {}).reduce((n: number, draft: any) => n + Number(draft?.save_count || 0), 0);
    return total + created + saves;
  }, 0);
}

export function hasTargetCommitProgress(apps: Dict, initialApps: Dict, targetIds: string[]): boolean {
  const select = (state: Dict) => Object.fromEntries(targetIds.map(id => [id, state[id] || {}]));
  return countBusinessCommits(select(apps)) > countBusinessCommits(select(initialApps));
}
