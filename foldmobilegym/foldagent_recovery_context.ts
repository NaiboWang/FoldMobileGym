type Dict = Record<string, any>;

/** Only explicitly declared, other task apps belong to a recovery's scope. */
export function retainedAppIds(task: { apps: string[]; recovery?: { app_id: string; retained_apps?: string[] } | null }): string[] {
  if (!task.recovery || !Object.hasOwn(task.recovery, 'retained_apps')) return [];
  const ids = task.recovery.retained_apps;
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length
    || ids.some(id => typeof id !== 'string' || !id || !task.apps.includes(id) || id === task.recovery!.app_id)) {
    throw Error('Invalid retained-app recovery scope');
  }
  return [...ids];
}

export function captureRetainedApps(apps: Dict, ids: readonly string[]): Dict {
  return Object.fromEntries(ids.map(id => {
    const state = apps?.[id];
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw Error(`Missing retained app snapshot: ${id}`);
    const copy = JSON.parse(JSON.stringify(state));
    delete copy.route; delete copy.transient; delete copy.lifecycle;
    return [id, copy];
  }));
}

// Object-key presentation is not data loss; array order/content remains data.
export function retainedContextEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, i) => retainedContextEqual(value, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const entries = Object.entries(a);
  return entries.length === Object.keys(b).length && entries.every(([key, value]) => Object.hasOwn(b, key)
    && retainedContextEqual(value, (b as Dict)[key]));
}
