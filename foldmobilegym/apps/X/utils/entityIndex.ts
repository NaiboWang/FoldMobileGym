import type { XPost } from '../types';
import type { XRuntimePostTable } from './runtimePostResolver';

export interface XEntityIndex {
  posts: Map<string, XPost>;
  parents: Map<string, string>;
}
/** Full read-only entity graph: never derive identities from a visible feed window. */
export function buildXEntityIndex(worldPosts: readonly XPost[], worldReplies: Record<string, XPost[]>, runtime: XRuntimePostTable): XEntityIndex {
  const posts = new Map<string, XPost>(), parents = new Map<string, string>(), seen = new Set<XPost>();
  const visit = (raw: XPost | null | undefined, parent?: string) => {
    if (!raw?.id) return;
    const patch = Object.prototype.hasOwnProperty.call(runtime, raw.id) ? runtime[raw.id] : undefined;
    const post = patch === undefined ? raw : patch;
    if (!post || post.id !== raw.id) return;
    // Structural reply ownership is retained unless a full overlay explicitly moves it.
    if (post.threadId || parent) parents.set(post.id, post.threadId || parent!);
    if (seen.has(post)) return;
    seen.add(post);
    if (!posts.has(post.id)) posts.set(post.id, post);
    for (const reply of post.replies ?? []) visit(reply, post.id);
    visit(post.retweetedPost);
  };
  for (const post of worldPosts) visit(post);
  for (const [parent, replies] of Object.entries(worldReplies)) for (const reply of replies) visit(reply, parent);
  for (const post of Object.values(runtime)) visit(post);
  return { posts, parents };
}
export function findXQuotes(index: XEntityIndex, targetId: string): XPost[] {
  return [...index.posts.values()].filter(post => post.quotedPostId === targetId);
}
/** Aggregate counts do not identify actors. Only explicit local relationships do. */
export function findXReposterIds(index: XEntityIndex, targetId: string, userId: string, retweetedPostIds: readonly string[]): string[] {
  const ids = new Set<string>();
  for (const post of index.posts.values()) if (post.retweetedPostId === targetId && post.authorId) ids.add(post.authorId);
  if (retweetedPostIds.includes(targetId) && userId) ids.add(userId);
  return [...ids];
}
export function findXReplyTree(index: XEntityIndex, parentId: string): XPost[] {
  const children = new Map<string, XPost[]>();
  for (const [id, parent] of index.parents) {
    const post = index.posts.get(id);
    if (post) { const rows = children.get(parent); if (rows) rows.push(post); else children.set(parent, [post]); }
  }
  const build = (id: string, ancestry: Set<string>): XPost[] => (children.get(id) ?? []).flatMap(post => {
    if (ancestry.has(post.id)) return [];
    const next = new Set(ancestry); next.add(post.id);
    const nested = build(post.id, next);
    // Materialized tree is a view; it never enters persistent entity state.
    return [{ ...post, replies: nested.length ? nested : undefined }];
  });
  return build(parentId, new Set([parentId]));
}
