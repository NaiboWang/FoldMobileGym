export function nextAudiobookRecommendations(
  ids: readonly string[],
  current: readonly string[],
  limit = 6,
  random: () => number = Math.random,
): string[] {
  const currentIds = new Set(current);
  const unique = [...new Set(ids)];
  const shuffle = (items: string[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  // Maximize new entries; reuse current recommendations only when necessary.
  const fresh = shuffle(unique.filter(id => !currentIds.has(id)));
  const previous = shuffle(unique.filter(id => currentIds.has(id)));
  return fresh.concat(previous).slice(0, Math.max(0, limit));
}
