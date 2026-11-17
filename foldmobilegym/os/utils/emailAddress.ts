/** One supplied mailbox only; no URL decoding, address guessing or mail headers. */
export function normalizeEmailAddress(value: unknown): string | null {
  if (typeof value !== 'string' || /[\r\n\u0000-\u001f\u007f]/.test(value)) return null;
  const address = value.trim();
  return address.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(address) ? address : null;
}
