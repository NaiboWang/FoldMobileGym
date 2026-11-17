import { describe, expect, it } from 'vitest';
import { sortCommentsForPreference } from '../apps/Reddit/utils/commentSort';
import type { Comment } from '../apps/Reddit/types';

const comments: Comment[] = [
  { id: 'a', postId: 'post', author: 'one', body: 'A', score: 10, created_utc: 100 },
  { id: 'b', postId: 'post', author: 'two', body: 'B', score: 1, created_utc: 300 },
  { id: 'c', postId: 'post', author: 'three', body: 'C', score: 30, created_utc: 200 },
];

describe('Reddit comment sort preference', () => {
  it('keeps the established default order and supports top, new, and controversial', () => {
    const ids = (preference: 'best' | 'top' | 'new' | 'controversial') =>
      sortCommentsForPreference(comments, preference).map(comment => comment.id);
    expect(ids('best')).toEqual(['a', 'c', 'b']);
    expect(ids('top')).toEqual(['c', 'a', 'b']);
    expect(ids('new')).toEqual(['b', 'c', 'a']);
    expect(ids('controversial')).toEqual(['b', 'a', 'c']);
    expect(comments.map(comment => comment.id)).toEqual(['a', 'b', 'c']);
  });
});
