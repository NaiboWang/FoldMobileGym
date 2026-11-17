type Route = { pathname: string; search: string };

/** Cold-entry/recreated overlays have no guarantee of a parent history entry. */
export function smsComposeParent(pathname: string, search: string): string | null {
  // The list menu can cover the master while a compose/detail pane remains visible.
  if (pathname === '/' || pathname === '/new' || /^\/conversation\/[^/]+$/.test(pathname)) {
    const menu = new URLSearchParams(search);
    if (menu.has('contextMenu')) {
      menu.delete('contextMenu');
      return pathname + (menu.size ? `?${menu}` : '');
    }
  }
  if (/^\/conversation\/[^/]+$/.test(pathname)) {
    const params = new URLSearchParams(search);
    if (params.get('panel') !== 'attachments') return null;
    params.delete('panel');
    return pathname + (params.size ? `?${params}` : '');
  }
  if (pathname !== '/new') return null;
  const params = new URLSearchParams(search);
  if (params.get('dialog') === 'invalidRecipient') params.delete('dialog');
  else if (['contacts', 'attachments'].includes(params.get('panel') ?? '')) params.delete('panel');
  else return null;
  return pathname + (params.size ? `?${params}` : '');
}

const canonical = (params: URLSearchParams) => {
  params.sort();
  return params.toString();
};

/** Return null to pop a real parent, or its URL to replace a cold overlay. */
export function smsComposeBackFallback(pathname: string, search: string, previous?: Route): string | null {
  const parent = smsComposeParent(pathname, search);
  if (!parent) return null;
  if (previous?.pathname === pathname) {
    const current = new URLSearchParams(search);
    const prior = new URLSearchParams(previous.search);
    // Contacts can be opened from the attachment panel as well as the base editor.
    if (!current.has('dialog') && current.get('panel') === 'contacts'
      && prior.get('panel') === 'attachments' && !prior.has('dialog')) prior.delete('panel');
    const expected = new URLSearchParams(parent.split('?')[1] ?? '');
    if (canonical(prior) === canonical(expected)) return null;
  }
  return parent;
}
