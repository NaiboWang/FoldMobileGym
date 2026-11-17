/** Decode the raw pathname segment once. Router params may decode a literal %2F twice. */
export function calendarEventIdFromPath(pathname: string): string | undefined {
  const match = /^\/event\/([^/]+)(?:\/edit)?$/.exec(pathname);
  if (!match) return undefined;
  try { return decodeURIComponent(match[1]); } catch { return undefined; }
}
