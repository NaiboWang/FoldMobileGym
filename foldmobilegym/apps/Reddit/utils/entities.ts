import type { RedditPost, RedditPostsOverlay } from '../types';

/** Resolve public entities, not just the current user's ownership index. */
export function resolveRedditPosts(fixture: RedditPost[], overlay: RedditPostsOverlay, ownedIds: string[]): RedditPost[] {
  const base = new Map<string, RedditPost>();
  for (const post of fixture) if (!base.has(String(post.id))) base.set(String(post.id), post);
  const seen = new Set<string>(), result: RedditPost[] = [];
  for (const id of [...ownedIds, ...base.keys(), ...Object.keys(overlay)]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const post = Object.prototype.hasOwnProperty.call(overlay, id) ? overlay[id] : base.get(id);
    if (post && String(post.id) === id) result.push(post);
  }
  return result;
}
