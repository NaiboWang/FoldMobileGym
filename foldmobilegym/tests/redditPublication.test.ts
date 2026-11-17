import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedditPost } from '../apps/Reddit/types';
import { allocatePostId } from '../apps/Reddit/utils/postIdentity';
const fixture = vi.hoisted(() => ({ posts: [] as RedditPost[] }));
vi.mock('../apps/Reddit/data/loader', () => ({ getPostsSync: () => fixture.posts }));
import { useRedditStore } from '../apps/Reddit/state';
const initial = useRedditStore.getState();
const post = (id = 'user_post_123', title = 'Local title'): RedditPost => ({ id, title, author: 'stale-default', subreddit: 'r/self', timeAgo: 'now', content: 'Local body', upvotes: '1', comments: '0' });
beforeEach(() => {
  fixture.posts = [];
  useRedditStore.setState({ ...initial, posts: {}, comments: {}, user: { ...initial.user, username: 'actual-scenario-user', postIds: [], savedPostIds: [], postVotes: {} } });
});
describe('Reddit collision-safe publication', () => {
  it('retains two intentional identical-timestamp publications with unique indexes', () => {
    const first = initial.createPost(post()), second = initial.createPost(post(undefined, 'Second'));
    const state = useRedditStore.getState();
    expect([first, second]).toEqual(['user_post_123', 'user_post_123_1']);
    expect(state.user.postIds).toEqual([first, second]);
    expect(state.posts[first!]?.title).toBe('Local title');
    expect(state.posts[second!]?.title).toBe('Second');
    expect(state.user.postVotes).toEqual({ user_post_123: 'up', user_post_123_1: 'up' });
  });
  it('does not revive tombstones or reuse missing ownership/saved/voted/comment targets', () => {
    useRedditStore.setState({ posts: { user_post_123: null },
      user: { ...useRedditStore.getState().user, postIds: ['user_post_123_1'], savedPostIds: ['user_post_123_2'], postVotes: { user_post_123_3: 'down' } },
      comments: { c: { id: 'c', postId: 'user_post_123_4', author: 'reader', body: 'reference' } } });
    expect(initial.createPost(post())).toBe('user_post_123_5');
    const state = useRedditStore.getState();
    expect(state.posts.user_post_123).toBeNull();
    expect(state.user.savedPostIds).toEqual(['user_post_123_2']);
    expect(state.user.postVotes.user_post_123_3).toBe('down');
    expect(state.comments.c?.postId).toBe('user_post_123_4');
  });
  it('reserves loaded world IDs without copying world data into the overlay', () => {
    fixture.posts = [post()]; const before = JSON.stringify(fixture.posts);
    expect(initial.createPost(post())).toBe('user_post_123_1');
    expect(Object.keys(useRedditStore.getState().posts)).toEqual(['user_post_123_1']);
    expect(JSON.stringify(fixture.posts)).toBe(before);
  });
  it('uses the actual current actor and leaves the caller record unchanged', () => {
    const supplied = post(); initial.createPost(supplied);
    expect(useRedditStore.getState().posts.user_post_123?.author).toBe('actual-scenario-user');
    expect(supplied.author).toBe('stale-default');
  });
  it('keeps unrelated data and the existing draft-reset semantics intact', () => {
    const before = useRedditStore.getState(); initial.createPost(post()); const after = useRedditStore.getState();
    expect(after.settings).toBe(before.settings); expect(after.chatThreads).toBe(before.chatThreads);
    expect(after.createDraft).toEqual({ selectedCommunity: null, selectedFlairs: [] });
  });
  it('does not mutate anything for an empty title or identity', () => {
    const before = useRedditStore.getState();
    expect(initial.createPost(post('', 'title'))).toBeNull(); expect(initial.createPost(post('id', '  '))).toBeNull();
    expect(useRedditStore.getState()).toBe(before);
  });
  it('allocates the first available suffix without rewriting the preferred time', () => {
    expect(allocatePostId('user_post_0', { user_post_0: null, user_post_0_2: null }, ['user_post_0_1'], [])).toBe('user_post_0_3');
    expect(allocatePostId('literal /% 中文', {}, [], [])).toBe('literal /% 中文');
  });
});
