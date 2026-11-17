export function getAlarmOverlay(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  const value = pathname === '/alarm' ? params.get('panel') : null;
  const panel = value === 'add' || value === 'edit' || value === 'quick' ? value : null;
  return {
    panel,
    alarmId: params.get('alarmId') ?? '',
    isEditor: panel === 'add' || panel === 'edit',
    isEdit: panel === 'edit',
    isRepeat: (panel === 'add' || panel === 'edit') && params.get('repeat') === 'open',
    isRingtone: (panel === 'add' || panel === 'edit') && params.get('ringtone') === 'open',
  };
}

/** Cold/external nested entry may not have its parent in MemoryRouter history. */
export function getAlarmBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }) {
  const overlay = getAlarmOverlay(pathname, search);
  if (!overlay.panel) return null;
  if (overlay.isRepeat || overlay.isRingtone) {
    const parent = previous && getAlarmOverlay(previous.pathname, previous.search);
    if (parent?.panel === overlay.panel && parent.alarmId === overlay.alarmId && !parent.isRepeat && !parent.isRingtone) return null;
    const params = new URLSearchParams(search);
    params.delete('repeat');
    params.delete('ringtone');
    return `/alarm?${params.toString()}`;
  }
  return previous ? null : '/alarm';
}
