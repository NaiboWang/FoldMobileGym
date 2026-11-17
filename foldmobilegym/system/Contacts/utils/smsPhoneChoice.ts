import type { ContactPhone } from '../types';

/** Keep the current SMS address contract; do not invent country-code rules. */
export const contactSmsAddress = (number: string): string => number.replace(/\s+/g, '');

/** Unique reachable addresses, primary first, retaining exact provider objects. */
export function contactSmsPhones(phones: readonly ContactPhone[] | null | undefined): ContactPhone[] {
  const available = phones ?? [];
  const seen = new Set<string>();
  return [...available.filter(phone => phone.isPrimary), ...available.filter(phone => !phone.isPrimary)]
    .filter(phone => {
      const address = contactSmsAddress(phone.number);
      if (!address || seen.has(address)) return false;
      seen.add(address); return true;
    });
}

/** A cold picker owns its detail; a warm picker pops only its exact parent. */
export function contactSmsPickerBackFallback(pathname: string, search: string,
  previous?: { pathname: string; search: string }): string | null {
  const query = new URLSearchParams(search);
  if (!/^\/contact\/[^/]+$/.test(pathname) || query.get('modal') !== 'sms' || query.has('menu')) return null;
  query.delete('modal');
  const expected = new URLSearchParams(query); expected.sort();
  const before = new URLSearchParams(previous?.search); before.sort();
  if (previous?.pathname === pathname && before.toString() === expected.toString()) return null;
  return pathname + (query.size ? `?${query}` : '');
}
