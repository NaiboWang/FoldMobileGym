import type { XPost } from '../types';
import type { XRuntimePostTable } from './runtimePostResolver';

/** IDs are identities, not clocks. Reserve tombstones, ownership and loaded world IDs. */
export function allocateXPublicationId(
  kind: 'new' | 'reply',
  timestamp: number,
  posts: XRuntimePostTable,
  ownedIds: readonly string[],
  worldGroups: Iterable<readonly XPost[]> = [],
): string {
  const stem = `${kind}_${timestamp}`;
  const reserved = new Set([...Object.keys(posts), ...ownedIds]);
  const seen = new Set<XPost>();
  const reserve = (post: XPost | null | undefined) => {
    if (!post || seen.has(post)) return;
    seen.add(post);
    // Only retain possible collisions; never copy world entities into runtime state.
    if (post.id === stem || post.id.startsWith(`${stem}_`)) reserved.add(post.id);
    post.replies?.forEach(reserve);
    if (post.retweetedPost) reserve(post.retweetedPost);
  };
  Object.values(posts).forEach(reserve);
  for (const group of worldGroups) group.forEach(reserve);
  let id = stem;
  for (let suffix = 1; reserved.has(id); suffix += 1) id = `${stem}_${suffix}`;
  return id;
}
