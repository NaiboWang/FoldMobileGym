import { useMemo, useSyncExternalStore } from 'react';
import { useRedditStore } from '../state';
import type { RedditPost } from '../types';
import { getPostsSync, subscribePosts } from '../data/loader';
import { resolveRedditPosts } from '../utils/entities';

// Stable empty fallback so useSyncExternalStore's snapshot identity stays
// fixed before loadPosts() resolves — otherwise React would re-render on
// every commit (different `[]` reference each call).
const EMPTY_POSTS: RedditPost[] = Object.freeze([]) as readonly RedditPost[] as RedditPost[];

const getFixtureSnapshot = (): RedditPost[] => getPostsSync() ?? EMPTY_POSTS;

export function useFixturePosts(): RedditPost[] {
  return useSyncExternalStore(subscribePosts, getFixtureSnapshot, getFixtureSnapshot);
}

export function useRedditPosts(): RedditPost[] {
  const fixture = useFixturePosts();
  const postsOverlay = useRedditStore((state) => state.posts);
  const postIds = useRedditStore((state) => state.user.postIds);

  return useMemo(() => resolveRedditPosts(fixture, postsOverlay, postIds), [postIds, postsOverlay, fixture]);
}

export function useRedditPostById(id: string | null | undefined): RedditPost | null {
  const posts = useRedditPosts();

  return useMemo(() => {
    if (!id) return null;
    return posts.find((post) => post.id === id) ?? null;
  }, [id, posts]);
}
