import { describe, expect, it } from 'vitest';
import { sortShelfItems, type ShelfSort } from '../apps/WechatReading/utils/shelfSort';
import type { Book } from '../apps/WechatReading/data/types';
const entry = (id: string, values: Partial<Book> = {}) => ({ bookId: id,
  book: { id, title: id, author: 'Local author', totalWords: 10, ...values } });
const rows = [entry('b', { title: 'Book 10', category: 'B', totalWords: 20, recommendedValue: 80 }),
  entry('a', { title: 'Book 2', category: 'A', totalWords: 100, recommendedValue: 95 }),
  entry('missing', { category: undefined, totalWords: NaN })];
const ids = (sort: ShelfSort) => sortShelfItems(rows, sort).map(row => row.bookId);
describe('source-only bookshelf sorting', () => {
  it('keeps default source order and numeric title order', () => {
    expect(ids('default')).toEqual(['b','a','missing']);
    expect(ids('title')).toEqual(['a','b','missing']);
  });
  it('sorts category ascending and numeric metadata descending, missing last', () => {
    expect(ids('category')).toEqual(['a','b','missing']);
    expect(ids('words')).toEqual(['a','b','missing']);
    expect(ids('recommendation')).toEqual(['a','b','missing']);
  });
  it('keeps ties stable without mutating frozen input records', () => {
    const frozen = Object.freeze(rows.map(row => Object.freeze(row)));
    const before = JSON.stringify(frozen);
    for (const mode of ['default','title','category','words','recommendation'] as const) sortShelfItems(frozen, mode);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(sortShelfItems([entry('b'),entry('a')], 'words').map(row => row.bookId)).toEqual(['b','a']);
  });
});


describe('estimated local reading progress projection', () => {
  it('orders comparable ratios descending, clamps overrun, keeps missing and invalid records last without mutating inputs', () => {
    const list = [entry('a', { totalWords: 100 }), entry('b', { totalWords: 1000 }),
      entry('c', { totalWords: 10 }), entry('zero', { totalWords: 0 }), entry('absent'), entry('invalid')];
    const progress = { a: { bookId: 'a', charOffset: 50, lastReadAt: '' },
      b: { bookId: 'b', charOffset: 900, lastReadAt: '' }, c: { bookId: 'c', charOffset: 100, lastReadAt: '' },
      zero: { bookId: 'zero', charOffset: 0, lastReadAt: '' }, invalid: { bookId: 'invalid', charOffset: NaN, lastReadAt: '' } };
    const before = JSON.stringify({ list, progress });
    expect(sortShelfItems(list, 'progress', progress).map(row => row.bookId)).toEqual(['c','b','a','zero','absent','invalid']);
    expect(JSON.stringify({ list, progress })).toBe(before);
  });
  it('does not attribute a mismatched progress record to another book', () => {
    const list = [entry('wrong'), entry('valid')];
    const progress = { wrong: { bookId:'other', charOffset: 9, lastReadAt:'' }, valid: { bookId:'valid', charOffset: 1, lastReadAt:'' } };
    expect(sortShelfItems(list, 'progress', progress).map(row => row.bookId)).toEqual(['valid','wrong']);
  });
  it('orders valid zero progress before absent and retains tie order', () => {
    const list = [entry('unknown'), entry('first'), entry('second'), entry('negative')];
    const progress = { first: { bookId:'first', charOffset: 0, lastReadAt:'' }, second: { bookId:'second', charOffset: 0, lastReadAt:'' }, negative: { bookId:'negative', charOffset: -1, lastReadAt:'' } };
    expect(sortShelfItems(list, 'progress', progress).map(row => row.bookId)).toEqual(['first','second','unknown','negative']);
  });
});
