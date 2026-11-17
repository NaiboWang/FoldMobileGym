export function dialNumbersMatch(a: string, b: string): boolean {
  const normalize = (value: string) => value.replace(/[\s().-]/g, '');
  const normalized = normalize(a);
  return normalized.length > 0 && normalized === normalize(b);
}
