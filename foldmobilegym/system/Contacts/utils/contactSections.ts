import type { Contact } from '../types';

// Representative starts of the Mandarin pinyin collation buckets provided by
// Intl. This is a UI approximation, not a pronunciation or transliteration API.
const PINYIN_STARTS: ReadonlyArray<readonly [string, string]> = [
  ['A', '阿'], ['B', '八'], ['C', '嚓'], ['D', '哒'], ['E', '婀'],
  ['F', '发'], ['G', '旮'], ['H', '哈'], ['J', '击'], ['K', '咔'],
  ['L', '垃'], ['M', '妈'], ['N', '拿'], ['O', '噢'], ['P', '趴'],
  ['Q', '七'], ['R', '然'], ['S', '仨'], ['T', '他'], ['W', '挖'],
  ['X', '西'], ['Y', '压'], ['Z', '匝'],
];

export const contactsCollator = new Intl.Collator('zh-Hans-CN-u-co-pinyin', {
  numeric: true,
  sensitivity: 'base',
});

export function contactSectionKey(contact: Pick<Contact, 'sectionKey' | 'sortKey' | 'displayName'>): string {
  const explicit = (contact.sectionKey ?? '').trim();
  if (/^[A-Z#]$/.test(explicit)) return explicit;
  const sortFirst = (contact.sortKey ?? '').trim()[0] ?? '';
  if (/^[A-Za-z]$/.test(sortFirst)) return sortFirst.toUpperCase();
  const first = Array.from((contact.displayName ?? '').trim())[0] ?? '';
  if (/^[A-Za-z]$/.test(first)) return first.toUpperCase();
  if (!/^\p{Script=Han}$/u.test(first)) return '#';
  let section = 'A';
  for (const [letter, start] of PINYIN_STARTS) {
    if (contactsCollator.compare(first, start) < 0) break;
    section = letter;
  }
  return section;
}
