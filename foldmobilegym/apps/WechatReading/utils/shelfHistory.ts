/** Only pop to a known actual shelf entry; never guess a fixed history distance. */
export function shelfReturnDelta(stack: readonly { pathname: string; search: string }[], index: number): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= stack.length) return null;
  for (let target = index - 1; target >= 0; target--) {
    if (stack[target].pathname === '/bookshelf' && stack[target].search === '') return index - target;
  }
  return null;
}

/** Cold overlays dismiss one logical shelf layer instead of escaping to an unrelated page. */
export function shelfBackFallback(current: { pathname: string; search: string }, previous?: { pathname: string; search: string }): string | null {
  if (current.pathname !== '/bookshelf') return null;
  const query = new URLSearchParams(current.search), prior = new URLSearchParams(previous?.search);
  const modal = query.get('modal'), selected = query.get('select') === 'true';
  if (modal === 'confirm_remove' || modal === 'private_reading') {
    const priorMatches = previous?.pathname === '/bookshelf' && !prior.has('modal')
      && (selected ? prior.get('select') === 'true' : !prior.has('select'));
    return priorMatches ? null : selected ? '/bookshelf?select=true' : '/bookshelf';
  }
  if (selected && !query.has('modal')) {
    return previous?.pathname === '/bookshelf' && !prior.has('select') && !prior.has('modal') ? null : '/bookshelf';
  }
  return null;
}
