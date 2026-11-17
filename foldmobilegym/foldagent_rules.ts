/** JSON partial containment shared by success rules and commit inference.
 * Lists mean unordered membership, not equality, order, or multiplicity.
 * Exact counts/order must be expressed with separate task constraints.
 */
export function objectContains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && expected.every(item => actual.some(candidate => objectContains(candidate, item)));
  }
  if (expected !== null && typeof expected === 'object') {
    return actual !== null && typeof actual === 'object' && !Array.isArray(actual)
      && Object.entries(expected).every(([key, value]) => Object.hasOwn(actual, key)
        && objectContains((actual as Record<string, unknown>)[key], value));
  }
  return actual === expected;
}
