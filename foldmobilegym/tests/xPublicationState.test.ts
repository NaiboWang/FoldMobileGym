import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { XPost } from '../apps/X/types';
const fixtures = vi.hoisted(() => ({ timestamp: 1792350000000, posts: [] as XPost[], replies: {} as Record<string, XPost[]> }));
vi.mock('../os/TimeService', async importOriginal => ({
  ...await importOriginal<typeof import('../os/TimeService')>(), now: () => fixtures.timestamp,
}));
vi.mock('../apps/X/data/loader', () => ({
  getXBaseDataset: () => fixtures, preload: vi.fn(), loadReplies: vi.fn(),
}));
import { useXStore } from '../apps/X/state';
import { resolveXPostCreatedAt } from '../apps/X/utils/formatTime';
const initial = useXStore.getState();
const post = (id: string): XPost => ({ id, authorId: 'world', content: 'world content', time: 'just now', stats: { comments: 0, retweets: 0, likes: 0, views: 0 } });
beforeEach(() => {
  fixtures.timestamp = 1792350000000; fixtures.posts = []; fixtures.replies = {};
  useXStore.setState({ ...initial, posts: {}, pendingQuotedPostId: null, user: { ...initial.user, postIds: [], replyIds: [], likedPostIds: [], retweetedPostIds: [], bookmarkedPostIds: [] } });
});
describe('X synchronous publication transactions', () => {
  it('preserves two different posts and their unique ownership at frozen time', () => {
    initial.addPost('first'); initial.addPost('second');
    const state = useXStore.getState();
    expect(state.user.postIds).toEqual(['new_1792350000000_1', 'new_1792350000000']);
    expect(state.user.postIds.map(id => state.posts[id]?.content)).toEqual(['second', 'first']);
    expect(Object.keys(state.posts)).toHaveLength(2);
    expect(Object.values(state.posts).map(p => p?.createdAt)).toEqual(['2026-10-18T19:00:00.000Z', '2026-10-18T19:00:00.000Z']);
  });
  it('keeps replies to different targets independent at frozen time', () => {
    initial.addReply('p_target_A', 'reply A'); initial.addReply('p_target_B', 'reply B');
    const state = useXStore.getState();
    expect(state.user.replyIds).toHaveLength(2); expect(new Set(state.user.replyIds).size).toBe(2);
    expect(state.user.replyIds.map(id => [state.posts[id]?.threadId, state.posts[id]?.content])).toEqual([['p_target_B','reply B'], ['p_target_A','reply A']]);
    expect(state.user.postIds).toEqual([]);
  });
  it('allows intentional identical publications from separate action invocations', () => {
    initial.addPost('same text'); initial.addPost('same text');
    expect(Object.keys(useXStore.getState().posts)).toHaveLength(2);
  });
  it('does not overwrite prior records after a backwards and forwards time jump', () => {
    initial.addPost('first'); fixtures.timestamp -= 60_000; initial.addPost('backwards');
    fixtures.timestamp += 60_000; initial.addPost('returned');
    const state = useXStore.getState(); expect(Object.keys(state.posts)).toHaveLength(3);
    expect(state.user.postIds.map(id => state.posts[id]?.content)).toEqual(['returned','backwards','first']);
  });
  it('reserves tombstones and ownership-only records after reconstruction', () => {
    useXStore.setState({ posts: { new_1792350000000: null }, user: { ...useXStore.getState().user, replyIds: ['new_1792350000000_1'] } });
    initial.addPost('new after restart');
    const state = useXStore.getState(); expect(state.posts.new_1792350000000).toBeNull();
    expect(state.user.replyIds).toEqual(['new_1792350000000_1']);
    expect(state.user.postIds).toEqual(['new_1792350000000_2']);
  });
  it('reserves world entities without persisting copies of the base data', () => {
    fixtures.posts = [post('new_1792350000000')]; fixtures.replies = { root: [post('reply_1792350000000')] };
    const before = JSON.stringify(fixtures);
    initial.addPost('local'); initial.addReply('root', 'local reply');
    const state = useXStore.getState();
    expect(state.user.postIds).toEqual(['new_1792350000000_1']);
    expect(state.user.replyIds).toEqual(['reply_1792350000000_1']);
    expect(Object.keys(state.posts)).toHaveLength(2); expect(JSON.stringify(fixtures)).toBe(before);
  });
  it('writes the actual runtime user identity, not the imported default account', () => {
    useXStore.setState({ user: { ...useXStore.getState().user, id: 'CaseSensitiveScenarioUser' } });
    initial.addPost('post'); initial.addReply('root', 'reply');
    expect(Object.values(useXStore.getState().posts).map(p => p?.authorId)).toEqual(['CaseSensitiveScenarioUser', 'CaseSensitiveScenarioUser']);
  });
  it('consumes a pending quote once while preserving explicit quote and media input', () => {
    useXStore.setState({ pendingQuotedPostId: 'pending_target' });
    initial.addPost('quoted', 'image_path', 'explicit_target'); initial.addPost('plain');
    const state = useXStore.getState(); const [plain, quoted] = state.user.postIds.map(id => state.posts[id]);
    expect(quoted).toMatchObject({ quotedPostId: 'explicit_target', image: 'image_path' });
    expect(plain?.quotedPostId).toBeUndefined(); expect(state.pendingQuotedPostId).toBeNull();
  });
  it('retains pending-quote fallback and unrelated settings/conversations', () => {
    const before = useXStore.getState(); useXStore.setState({ pendingQuotedPostId: 'fallback' });
    initial.addPost('quoted'); initial.addReply('target', 'reply');
    const state = useXStore.getState(); expect(state.posts[state.user.postIds[0]]?.quotedPostId).toBe('fallback');
    expect(state.settings).toBe(before.settings); expect(state.conversations).toBe(before.conversations);
  });
  it('isolates explicit standalone shares from a warm pending quote without changing legacy consumption', () => {
    useXStore.setState({ pendingQuotedPostId: 'warm_owned_quote' });
    initial.addPost('shared text', undefined, null);
    let state = useXStore.getState();
    expect(state.posts[state.user.postIds[0]]?.quotedPostId).toBeUndefined();
    expect(state.pendingQuotedPostId).toBe('warm_owned_quote');
    initial.addPost('ordinary pending quote');
    state = useXStore.getState();
    expect(state.posts[state.user.postIds[0]]?.quotedPostId).toBe('warm_owned_quote');
    expect(state.pendingQuotedPostId).toBeNull();
  });
  it('keeps epoch zero valid and derives suffix IDs without corrupting absolute time', () => {
    fixtures.timestamp = 0; initial.addReply('root', 'first'); initial.addReply('root', 'second');
    const state = useXStore.getState(); expect(state.user.replyIds).toEqual(['reply_0_1', 'reply_0']);
    expect(state.posts.reply_0_1?.createdAt).toBe('1970-01-01T00:00:00.000Z');
    expect(resolveXPostCreatedAt({ id: 'new_1792350000000_12' })).toBe('2026-10-18T19:00:00.000Z');
  });
});
