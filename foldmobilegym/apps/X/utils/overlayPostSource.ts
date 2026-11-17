import type { XPost } from '../types';
import type { XBaseDataset } from '../data/loader';
import { getXRuntimePostEntry, type XRuntimePostTable } from './runtimePostResolver';
import { resolveRawReplyById } from './hydrate';

/** Return the raw immutable source reference, not a freshly hydrated view object. */
export function getXOverlayPostSource(posts: XRuntimePostTable, base: Pick<XBaseDataset, 'posts' | 'replies'>, id: string): XPost | null {
  if (!id) return null;
  const runtime = getXRuntimePostEntry(posts, id);
  if (runtime !== undefined) return runtime;
  const direct = base.posts.find(post => post.id === id) ?? resolveRawReplyById(base.replies, id);
  if (direct) return direct;
  const seen = new Set<XPost>();
  const find = (post: XPost | null | undefined): XPost | null => {
    if (!post || seen.has(post)) return null;
    seen.add(post);
    if (post.id === id) return post;
    for (const reply of post.replies ?? []) { const found = find(reply); if (found) return found; }
    return find(post.retweetedPost);
  };
  for (const post of Object.values(posts)) { const found = find(post); if (found) return found; }
  for (const post of base.posts) { const found = find(post); if (found) return found; }
  return null;
}
