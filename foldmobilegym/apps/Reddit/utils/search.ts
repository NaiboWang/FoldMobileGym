import type { Comment, RedditCommentsOverlay, RedditCommunity, RedditPost } from '../types';

export type SearchTab = 'all' | 'posts' | 'communities' | 'comments';
export type SearchHit = { kind: 'posts'; post: RedditPost }
  | { kind: 'communities'; community: RedditCommunity }
  | { kind: 'comments'; post: RedditPost; comment: Comment };

export const normalizeSearchText = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/gu, ' ').trim();
const communityName = (name: string) => normalizeSearchText(name).replace(/^r\//, '');
export const readSearchTab = (value: string | null): SearchTab =>
  value === 'posts' || value === 'communities' || value === 'comments' ? value : 'all';
export const searchHitKey = (hit: SearchHit): string => hit.kind === 'comments'
  ? JSON.stringify([hit.kind, hit.post.id, hit.comment.id])
  : JSON.stringify([hit.kind, hit.kind === 'posts' ? hit.post.id : hit.community.id]);

/** Same complete-entity/tombstone resolution for search and the actual detail. */
export function resolvePostComments(post: RedditPost | null, table: RedditCommentsOverlay, runtimeRows = Object.entries(table)): Comment[] {
  if (!post) return [];
  const rows: Comment[] = [], seen = new Set<string>();
  for (const raw of post.commentsData ?? []) {
    const id = String(raw.id);
    const overlay = Object.prototype.hasOwnProperty.call(table, id);
    const comment = overlay ? table[id] : { ...raw, id, postId: post.id };
    if (!comment || comment.id !== id || comment.postId !== post.id || seen.has(id)) continue;
    seen.add(id); rows.push(comment);
  }
  for (const [id, comment] of runtimeRows) {
    if (!comment || comment.id !== id || comment.postId !== post.id || seen.has(id)) continue;
    seen.add(id); rows.push(comment);
  }
  return rows;
}

type Entry = { hit: SearchHit; fields: string[] };
export function buildRedditSearchIndex(posts: RedditPost[], table: RedditCommentsOverlay, communities: RedditCommunity[]) {
  const entries: Entry[] = [];
  const add = (hit: SearchHit, fields: string[]) => entries.push({ hit, fields: fields.map(normalizeSearchText) });
  const seenCommunities = new Set<string>();
  for (const community of communities) {
    if (seenCommunities.has(community.id)) continue;
    seenCommunities.add(community.id); add({ kind: 'communities', community }, [community.name]);
  }
  // Group runtime comments once; do not scan the whole table for every post.
  const byPost = new Map<string, [string, Comment][]>();
  for (const [id, comment] of Object.entries(table)) {
    if (!comment) continue;
    let group = byPost.get(comment.postId);
    if (!group) { group = []; byPost.set(comment.postId, group); }
    group.push([id, comment]);
  }
  const seenPosts = new Set<string>();
  for (const post of posts) {
    if (seenPosts.has(post.id)) continue;
    seenPosts.add(post.id);
    add({ kind: 'posts', post }, [post.title, post.content ?? '', post.author, post.subreddit]);
  }
  // Resolve base IDs against the full overlay so moved/deleted comments cannot
  // leak through the original post. Runtime-only rows use the per-post group.
  const seenCommentPosts = new Set<string>();
  for (const post of posts) {
    if (seenCommentPosts.has(post.id)) continue;
    seenCommentPosts.add(post.id);
    const resolved = resolvePostComments(post, table, byPost.get(post.id) ?? []);
    for (const comment of resolved) add({ kind: 'comments', post, comment }, [comment.body, comment.author, post.subreddit]);
  }
  return { entries, communities };
}

export function searchReddit(index: ReturnType<typeof buildRedditSearchIndex>, query: string, tab: SearchTab, communityId = ''): SearchHit[] {
  const term = normalizeSearchText(query);
  if (!term && !communityId) return [];
  const community = communityId ? index.communities.find(item => item.id === communityId) : null;
  if (communityId && !community) return [];
  return index.entries.filter(entry => {
    if (tab !== 'all' && entry.hit.kind !== tab) return false;
    if (community) {
      const actual = entry.hit.kind === 'communities' ? entry.hit.community.name : entry.hit.post.subreddit;
      if (communityName(actual) !== communityName(community.name)) return false;
    }
    return !term || entry.fields.some(field => field.includes(term));
  }).map(entry => entry.hit);
}
