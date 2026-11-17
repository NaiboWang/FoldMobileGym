import { describe, expect, it } from 'vitest';
import { allocateXPublicationId } from '../apps/X/utils/publicationId';
import type { XPost } from '../apps/X/types';
const post = (id: string, extra: Partial<XPost> = {}): XPost => ({
  id, authorId: 'author', content: 'unchanged', time: 'just now',
  stats: { comments: 0, retweets: 0, likes: 0, views: 0 }, ...extra,
});
describe('X publication identity allocation', () => {
  it('retains the original ID shape when it is unoccupied', () => {
    expect(allocateXPublicationId('new', 123, {}, [])).toBe('new_123');
    expect(allocateXPublicationId('reply', 123, {}, [])).toBe('reply_123');
  });
  it('reserves full overlays, tombstones and explicit undefined keys', () => {
    const table = { new_123: post('new_123'), new_123_1: null, new_123_2: undefined };
    expect(allocateXPublicationId('new', 123, table, [])).toBe('new_123_3');
    expect(Object.keys(table)).toHaveLength(3);
    expect(table.new_123_1).toBeNull();
  });
  it('reserves IDs referenced by ownership even without a runtime entity', () => {
    expect(allocateXPublicationId('reply', 123, {}, ['reply_123', 'reply_123_1'])).toBe('reply_123_2');
  });
  it('does not overwrite loaded world posts, nested replies or embedded retweets', () => {
    const world = [post('new_123', { replies: [post('new_123_1')], retweetedPost: post('new_123_2') })];
    const before = JSON.stringify(world);
    expect(allocateXPublicationId('new', 123, {}, [], [world, [post('new_123_3')]])).toBe('new_123_4');
    expect(JSON.stringify(world)).toBe(before);
  });
  it('reserves nested runtime identities and safely traverses shared references', () => {
    const shared = post('reply_123');
    shared.replies = [shared, post('reply_123_1')];
    expect(allocateXPublicationId('reply', 123, { other: shared }, [])).toBe('reply_123_2');
  });
  it('remains case-sensitive and does not merge distinct prefixes or timestamps', () => {
    expect(allocateXPublicationId('new', 123, { NEW_123: null, reply_123: null, new_1234: null }, [])).toBe('new_123');
  });
  it('does not manufacture timestamps for uniqueness or require a persistent counter', () => {
    expect(allocateXPublicationId('new', 0, { new_0: null, new_0_2: null }, [])).toBe('new_0_1');
    expect(allocateXPublicationId('new', 0, { new_0: null, new_0_2: null }, [])).toBe('new_0_1');
  });
});
