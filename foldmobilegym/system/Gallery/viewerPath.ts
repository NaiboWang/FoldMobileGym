/** Resolve the raw encoded route once, preserving literal %2F in file names.
 * React Router params also unescape encoded slashes and can conflate these
 * identities; the raw MemoryRouter pathname retains the original segment.
 */
export function galleryViewerPath(pathname: string): string {
  const prefix = '/photo/';
  if (!pathname.startsWith(prefix)) return '';
  try { return decodeURIComponent(pathname.slice(prefix.length)); }
  catch { return ''; }
}
