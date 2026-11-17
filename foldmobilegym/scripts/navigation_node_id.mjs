/** Dynamic query values are not discrete UI states. */
export function buildNodeId(path, search, queryParams) {
  const parts = [];
  const dynamicKeys = new Set(Object.keys(queryParams ?? {}));
  // A fixed runtime value of a dynamic query still targets its canonical route
  // node, not a nonexistent node with both `from=search` and `from=:from`.
  for (const [key, value] of Object.entries(search)) {
    if (!dynamicKeys.has(key)) parts.push(`${key}=${value}`);
  }
  for (const key of Object.keys(queryParams ?? {}).sort()) parts.push(`${key}=:${key}`);
  return parts.length ? `${path}?${parts.join('&')}` : path;
}
