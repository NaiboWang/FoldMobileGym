/** A displayed preference key must not remove a replacement file's binding. */
export function favoriteBindingIsCurrent(
  state: { favoritePaths: string[]; favoriteIds?: Record<string, string> },
  key: string,
  displayedId: string | undefined,
): boolean {
  return state.favoritePaths.includes(key) && state.favoriteIds?.[key] === displayedId;
}
