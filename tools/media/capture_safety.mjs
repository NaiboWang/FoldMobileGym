export function parseLocalPreview(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password)
    throw new Error('Screenshot capture requires a credential-free loopback HTTP URL');
  return url;
}

export function allowCaptureRequest(base, value, method) {
  if (method !== 'GET') return false;
  try {
    const url = new URL(value);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return true;
    const pathname = decodeURIComponent(url.pathname);
    return url.origin === base.origin && pathname !== '/api' && !pathname.startsWith('/api/');
  } catch { return false; }
}

/** Original vector placeholder; input is used only for palette selection, not embedded. */
export function illustrativeCover(value) {
  const colors = ['#466079', '#6c4f6f', '#537461', '#8b6550', '#56638a'];
  let index = 0;
  for (const char of value) index = (index * 31 + char.codePointAt(0)) % colors.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="${colors[index]}"/><circle cx="200" cy="200" r="125" fill="#111827" opacity=".38"/><circle cx="200" cy="200" r="48" fill="#fff" opacity=".16"/><path d="M218 104v147a29 29 0 1 1-15-25V136l78-19v105a29 29 0 1 1-15-25V101z" fill="#fff" opacity=".85"/></svg>`;
}
