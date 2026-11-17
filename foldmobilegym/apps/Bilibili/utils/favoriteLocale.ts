/** Format UI-owned folder counts without changing the underlying folder data. */
export function formatFavoriteCount(count: number, strings: { favorite_count_one: string; favorite_count_many: string }): string {
  return (count === 1 ? strings.favorite_count_one : strings.favorite_count_many).replace('{count}', String(count));
}
