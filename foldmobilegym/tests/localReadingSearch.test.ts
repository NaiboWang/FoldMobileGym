import { describe, expect, it } from 'vitest';
import { findTextExcerpt, matchesOwnedBookList } from '../apps/WechatReading/utils/localTextSearch';

describe('local reading search', () => {
  it('matches literal metacharacters and case without evaluating a regex', () => {
    expect(findTextExcerpt('A literal [.+ inside a paragraph', '[.+')).toContain('[.+');
    expect(findTextExcerpt('A CAPITAL word', 'capital')).toContain('CAPITAL');
    expect(findTextExcerpt('unrelated', 'missing')).toBeNull();
  });
  it('trims queries, rejects whitespace and bounds displayed context', () => {
    expect(findTextExcerpt('前'.repeat(100) + '命中' + '后'.repeat(100), ' 命中 ', 4)).toBe('…前前前前命中后后后后…');
    expect(findTextExcerpt('text', '  ')).toBeNull();
  });
  const books = [{ id: '1', title: 'Selected book', author: 'Alice', totalWords: 10 }, { id: '2', title: 'Not owned', author: 'Bob', totalWords: 20 }];
  const entries = [{ bookId: '1', recommendation: 'Worth rereading' }];
  it('searches actual list name, owner, included book and recommendation', () => {
    for (const query of ['favorites', 'Owner', 'selected', 'alice', 'rereading']) {
      expect(matchesOwnedBookList(query, 'Favorites', 'Owner', entries, books)).toBe(true);
    }
  });
  it('does not turn unrelated catalog books or empty input into list results', () => {
    expect(matchesOwnedBookList('not owned', 'Favorites', 'Owner', entries, books)).toBe(false);
    expect(matchesOwnedBookList('bob', 'Favorites', 'Owner', entries, books)).toBe(false);
    expect(matchesOwnedBookList(' ', 'Favorites', 'Owner', entries, books)).toBe(false);
  });
});
