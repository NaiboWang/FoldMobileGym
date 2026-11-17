import { describe, expect, it } from 'vitest';
import { literalHighlightParts } from '../apps/Bilibili/utils/literalHighlight';

describe('Bilibili search literal highlighting', () => {
  it('highlights repeated matches case-insensitively without altering text', () => {
    const parts = literalHighlightParts('AI and aI, ai!', 'ai');
    expect(parts.filter(part => part.matched).map(part => part.text)).toEqual(['AI', 'aI', 'ai']);
    expect(parts.map(part => part.text).join('')).toBe('AI and aI, ai!');
  });
  it.each(['(', ')', '[', ']', '{', '}', '.', '*', '+', '?', '^', '$', '|', '\\', '.*', '<img src=x onerror=alert(1)>'])(
    'treats %s as literal text rather than regex or HTML', query => {
      const original = `before ${query} after`;
      const parts = literalHighlightParts(original, query);
      expect(parts.map(part => part.text).join('')).toBe(original);
      expect(parts.filter(part => part.matched).map(part => part.text)).toEqual([query]);
    },
  );
  it('leaves empty queries and missing matches as plain text', () => {
    expect(literalHighlightParts('plain <b>text</b>', '')).toEqual([{ text: 'plain <b>text</b>', matched: false }]);
    expect(literalHighlightParts('plain <b>text</b>', 'absent')).toEqual([{ text: 'plain <b>text</b>', matched: false }]);
  });
});
