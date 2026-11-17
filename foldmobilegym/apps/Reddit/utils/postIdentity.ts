import type { RedditPost, RedditPostsOverlay } from '../types';

/** Suffix identity only: never move the clock or copy world entities to state. */
export function allocatePostId(preferred: string, posts: RedditPostsOverlay, reserved: string[], base: RedditPost[]): string {
  const occupied = new Set([...Object.keys(posts), ...reserved, ...base.map(post => String(post.id))]);
  let id = preferred, suffix = 0;
  while (occupied.has(id)) id = preferred + '_' + ++suffix;
  return id;
}
