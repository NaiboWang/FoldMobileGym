import { describe, expect, it } from 'vitest';
import { buildRedditSearchIndex, normalizeSearchText, readSearchTab, resolvePostComments, searchHitKey, searchReddit } from '../apps/Reddit/utils/search';
import type { Comment, RedditCommunity, RedditPost } from '../apps/Reddit/types';
import { resolveRedditPosts } from '../apps/Reddit/utils/entities';

const post = (id: string, values: Partial<RedditPost> = {}): RedditPost => ({ id, title: 'A literal title', author: 'tester', subreddit: 'r/example', timeAgo: 'now', upvotes: '10', comments: '1', ...values });
const comment = (id: string, postId = 'p', values: Partial<Comment> = {}): Comment => ({ id, postId, author: 'reader', body: 'A helpful answer', score: 2, ...values });
const communities: RedditCommunity[] = [{ id: 'com_example', name: 'r/example', members: '100' }, { id: 'other', name: 'r/other', members: '20' }];
const hits = (posts: RedditPost[], query: string, tab: 'all' | 'posts' | 'comments' | 'communities' = 'all') => searchReddit(buildRedditSearchIndex(posts, {}, communities), query, tab);

describe('Reddit complete local search', () => {
  it('resolves runtime-only public posts without impersonating current-user ownership', () => {
    const publicPost = post('public'), owned = post('owned');
    const ownedIds = ['owned', 'owned'];
    expect(resolveRedditPosts([post('base')], { public: publicPost, owned }, ownedIds).map(p => p.id)).toEqual(['owned', 'base', 'public']);
    expect(ownedIds).toEqual(['owned', 'owned']);
  });
  it('resolves complete replacements/tombstones and rejects mismatched post IDs', () => {
    const replacement = post('base', { title: 'replacement' });
    expect(resolveRedditPosts([post('base'), post('removed')], { base: replacement, removed: null, bad: post('another') }, ['removed'])).toEqual([replacement]);
  });
  it('deduplicates base records, preserving first source and stable order', () => {
    const first = post('a');
    expect(resolveRedditPosts([first, post('a'), post('b')], {}, ['a', 'a'])).toEqual([first, post('b')]);
  });
  it('normalizes case, compatibility width and whitespace without removing literal punctuation', () => {
    expect(normalizeSearchText(' ＡＢＣ\n  [x].* ')).toBe('abc [x].*');
    expect(hits([post('p', { title: 'ABC [x].*' })], 'ａｂｃ [x].*', 'posts')).toHaveLength(1);
    expect(hits([post('p')], '[x].*', 'posts')).toHaveLength(0);
  });
  it.each(['title', 'content', 'author', 'subreddit'] as const)('searches real post %s', field => {
    expect(hits([post('p', { [field]: 'unique needle' })], 'needle', 'posts')).toHaveLength(1);
  });
  it('has no 50-post result cap and preserves original source/order', () => {
    const posts = Array.from({ length: 260 }, (_, i) => post(String(i), { title: 'matching needle ' + i }));
    const result = hits(posts, 'needle', 'posts');
    expect(result).toHaveLength(260);
    expect(result.at(-1)).toEqual({ kind: 'posts', post: posts[259] });
    expect(result[0].kind === 'posts' && result[0].post).toBe(posts[0]);
  });
  it('searches base comment bodies and authors as actual comment hits', () => {
    const p = post('p', { commentsData: [comment('c', 'p')] });
    expect(hits([p], 'helpful', 'comments')[0].kind).toBe('comments');
    expect(hits([p], 'reader', 'comments')).toHaveLength(1);
    expect(hits([p], 'literal', 'comments')).toHaveLength(0);
  });
  it('distinguishes all four categories instead of deriving emptiness from another tab', () => {
    const p = post('p', { title: 'example', commentsData: [comment('c', 'p', { body: 'example' })] });
    const index = buildRedditSearchIndex([p], {}, communities);
    expect(searchReddit(index, 'example', 'all').map(hit => hit.kind)).toEqual(['communities', 'posts', 'comments']);
    expect(searchReddit(index, 'literal', 'communities')).toEqual([]);
    expect(searchReddit(index, 'example', 'comments')).toHaveLength(1);
  });
  it('does not fabricate trending facts or results for an empty query', () => {
    expect(hits([post('p')], '  ')).toEqual([]);
  });
  it('filters communities by actual catalog identity and exact post community, not a substring', () => {
    const first = post('p');
    const index = buildRedditSearchIndex([first, post('other', { subreddit: 'r/exampleExtra' })], {}, communities);
    expect(searchReddit(index, '', 'posts', 'com_example')).toEqual([{ kind: 'posts', post: first }]);
    expect(searchReddit(index, '', 'posts', 'unknown')).toEqual([]);
  });
  it('honors tombstones/full overrides and hides comments belonging to absent posts', () => {
    const p = post('p', { commentsData: [comment('base', 'p'), comment('deleted', 'p')] });
    const changed = comment('base', 'p', { body: 'new source' });
    const index = buildRedditSearchIndex([p], { base: changed, deleted: null, orphan: comment('orphan', 'missing') }, communities);
    expect(searchReddit(index, 'helpful', 'comments')).toEqual([]);
    expect(searchReddit(index, 'new source', 'comments')).toEqual([{ kind: 'comments', post: p, comment: changed }]);
  });
  it('resolves moved comments consistently with the actual post detail', () => {
    const a = post('a', { commentsData: [comment('c', 'a')] }), b = post('b');
    const moved = comment('c', 'b');
    expect(resolvePostComments(a, { c: moved })).toEqual([]);
    expect(resolvePostComments(b, { c: moved })).toEqual([moved]);
    const result = searchReddit(buildRedditSearchIndex([a, b], { c: moved }, communities), 'helpful', 'comments');
    expect(result).toEqual([{ kind: 'comments', post: b, comment: moved }]);
  });
  it('uses the full replacement post comments rather than the old fixture comments', () => {
    const replaced = post('p', { commentsData: [comment('replacement', 'p', { body: 'new body' })] });
    expect(hits([replaced], 'helpful', 'comments')).toEqual([]);
    expect(hits([replaced], 'new body', 'comments')).toHaveLength(1);
  });
  it('deduplicates source IDs without confusing post/comment namespaces', () => {
    const p = post('same', { commentsData: [comment('same', 'same'), comment('same', 'same')] });
    const result = hits([p, post('same')], 'r/example');
    expect(result.filter(hit => hit.kind === 'posts')).toHaveLength(1);
    expect(result.filter(hit => hit.kind === 'comments')).toHaveLength(1);
    expect(new Set(result.map(searchHitKey)).size).toBe(result.length);
  });
  it('does not expose malformed mismatched overlay IDs as another comment', () => {
    expect(resolvePostComments(post('p', { commentsData: [comment('c')] }), { c: comment('wrong') })).toEqual([]);
  });
  it('does not mutate records while indexing/filtering', () => {
    const p = post('p', { commentsData: [comment('c')] }), table = { own: comment('own') };
    const before = JSON.stringify({ p, table, communities });
    searchReddit(buildRedditSearchIndex([p], table, communities), 'helpful', 'all');
    expect(JSON.stringify({ p, table, communities })).toBe(before);
  });
  it.each([null, 'all', 'bogus'])('defaults unsupported tab %s to All', value => expect(readSearchTab(value)).toBe('all'));
  it.each(['posts', 'communities', 'comments'])('retains tab %s', value => expect(readSearchTab(value)).toBe(value));
});
