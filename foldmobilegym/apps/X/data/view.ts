/**
 * X view 层 — base dataset 订阅 + 视图 hook。
 *
 * 设计与 RedBook (`apps/RedBook/data/view.ts`) 对齐:
 *   - base 数据(users/posts/replies)只在 loader 模块缓存里, 不进 zustand store
 *   - 组件通过 useSyncExternalStore 订阅 loader, 通过 useXStore 订阅 runtime overlay
 *   - 视图合并由本文件内 hook 用 useMemo + utils/hydrate.ts 纯函数完成
 *
 * 每个 hook 内部:
 *   1. 订阅 base dataset (loader snapshot)
 *   2. 订阅 store runtime slice (useShallow 保证引用稳定)
 *   3. useMemo 合并 (依赖只在 base / runtime slice 任一变更时重算)
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { getXBaseDataset, subscribeBaseDataset, type XBaseDataset } from './loader';
import { conversations as baseConversations, notifications as baseNotifications, searchHistory as baseSearchHistory, currentUser } from './';
import { useXStore, type XStore } from '../state';
import {
  hydratePost,
  hydrateReplyTree,
  mergeLocalPosts,
  withRelationshipDerivedStats,
  runtimeCommentCounts,
  type XRuntimeMeSlice,
} from '../utils/hydrate';
import { buildXEntityIndex, findXQuotes, findXReposterIds, findXReplyTree } from '../utils/entityIndex';
import { getXLoadStatus, subscribeXLoadStatus } from './loader';
import type { XMessage, XPost, XUser } from '../types';

// ---- Base dataset subscription ----

/**
 * 订阅 X base dataset (users/posts/replies)。Loader 加载完成时返回的引用会换,
 * useSyncExternalStore 自动触发组件重渲染。
 */
export function useXBaseDataset(): XBaseDataset {
  return useSyncExternalStore(subscribeBaseDataset, getXBaseDataset, getXBaseDataset);
}

/** Empty successful reply datasets are ready too; availability is not inferred from row count. */
export function useXRepliesLoaded(): boolean {
  const status = useXLoadStatus();
  return status.replies === 'ready';
}

// ---- Internal slice selectors ----

const selectMeSlice = (s: XStore): XRuntimeMeSlice => ({
  id: s.user.id,
  likedPostIds: s.user.likedPostIds,
  retweetedPostIds: s.user.retweetedPostIds,
  followedUserIds: s.user.followedUserIds,
  followerUserIds: s.user.followerUserIds,
});

const selectRuntimePosts = (s: XStore) => s.posts;
const selectConversationsSlice = (s: XStore) => s.conversations;

// ---- Users ----

/**
 * 把 me user 投影成 user 字典里的一条 entry。like/bookmark/post 等不影响展示形态的
 * runtime 变更不会改变这个 slice (useShallow + 字段级浅比较), 避免下游字典重算。
 */
const selectMeUserEntry = (s: XStore): XUser => ({
  id: s.user.id,
  name: s.user.name,
  avatar: s.user.avatar,
  banner: s.user.banner,
  verified: s.user.verified,
  bio: s.user.bio,
  location: s.user.location,
  website: s.user.website,
  birthDate: s.user.birthDate,
  joinDate: s.user.joinDate,
  restId: s.user.restId,
  following: s.user.followedUserIds.length,
  followers: s.user.followerUserIds.length,
});

/** Base users + 当前 me user (合并后字典)。 */
export function useXAllUsers(): Record<string, XUser> {
  const base = useXBaseDataset();
  const meEntry = useXStore(useShallow(selectMeUserEntry));
  return useMemo(
    () => ({ ...base.users, [meEntry.id]: meEntry }),
    [base.users, meEntry],
  );
}

// ---- Local posts (runtime overlay + base, with relationship-derived stats + retweet shells) ----

export function useXLocalPosts(): XPost[] {
  const base = useXBaseDataset();
  const runtimePosts = useXStore(selectRuntimePosts);
  const me = useXStore(useShallow(selectMeSlice));
  return useMemo(
    () => mergeLocalPosts(runtimePosts, me, base.posts),
    [runtimePosts, me, base.posts],
  );
}

export function useXLoadStatus() {
  return useSyncExternalStore(subscribeXLoadStatus, getXLoadStatus, getXLoadStatus);
}
export function useXEntityIndex() {
  const base = useXBaseDataset(), runtime = useXStore(selectRuntimePosts);
  return useMemo(() => buildXEntityIndex(base.posts, base.replies, runtime), [base.posts, base.replies, runtime]);
}
function useXPostIndex(): Map<string, XPost> { return useXEntityIndex().posts; }

// ---- Hydrated timelines ----

const HYDRATED_FOR_YOU_LIMIT = 200;
const HYDRATED_FOLLOWING_LIMIT = 100;

export function useXHydratedPosts(): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  return useMemo(
    () => localPosts.slice(0, HYDRATED_FOR_YOU_LIMIT).map((p) => hydratePost(p, allUsers, postIndex)),
    [localPosts, allUsers, postIndex],
  );
}

export function useXHydratedFollowingPosts(): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  const followedUserIds = useXStore((s) => s.user.followedUserIds);
  return useMemo(() => {
    const followSet = new Set(followedUserIds);
    followSet.add(currentUser.id);
    return localPosts
      .filter((p) => followSet.has(p.authorId))
      .slice(0, HYDRATED_FOLLOWING_LIMIT)
      .map((p) => hydratePost(p, allUsers, postIndex));
  }, [localPosts, allUsers, postIndex, followedUserIds]);
}

/**
 * Home 页一次性产出 "For You" + "Following" 两条 timeline。比分别调用
 * useXHydratedPosts + useXHydratedFollowingPosts 共享一次 localPosts/allUsers/postIndex,
 * 避免重复 mergeLocalPosts / buildPostIndex。
 */
export function useXHomeTimelines(): { forYou: any[]; following: any[] } {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  const followedUserIds = useXStore((s) => s.user.followedUserIds);
  return useMemo(() => {
    const forYou = localPosts
      .slice(0, HYDRATED_FOR_YOU_LIMIT)
      .map((p) => hydratePost(p, allUsers, postIndex));
    const followSet = new Set(followedUserIds);
    followSet.add(currentUser.id);
    const following = localPosts
      .filter((p) => followSet.has(p.authorId))
      .slice(0, HYDRATED_FOLLOWING_LIMIT)
      .map((p) => hydratePost(p, allUsers, postIndex));
    return { forYou, following };
  }, [localPosts, allUsers, postIndex, followedUserIds]);
}

// ---- Single-post resolvers ----

/** 按 id 解析单个 post (本地 timeline -> postIndex -> replies)。 */
export function useXResolvedPost(postId: string): any | null {
  const localPosts = useXLocalPosts(), postIndex = useXPostIndex(), allUsers = useXAllUsers();
  return useMemo(() => {
    if (!postId || !postIndex.has(postId)) return null;
    const post = localPosts.find(item => item.id === postId) ?? postIndex.get(postId);
    return post ? hydratePost(post, allUsers, postIndex) : null;
  }, [postId, localPosts, postIndex, allUsers]);
}
/** Full entity query, followed by focused hydration. Never slice the Home feed first. */
export function useXPostActivity(postId: string) {
  const index = useXEntityIndex(), users = useXAllUsers(), me = useXStore(useShallow(selectMeSlice));
  const runtime = useXStore(selectRuntimePosts);
  return useMemo(() => {
    const commentCounts = runtimeCommentCounts(runtime);
    return {
      quotes: findXQuotes(index, postId).map(post => hydratePost(withRelationshipDerivedStats(post, me, commentCounts), users, index.posts)),
      reposters: findXReposterIds(index, postId, me.id, me.retweetedPostIds).map(id => ({ id, user: users[id] ?? null })),
    };
  }, [index, postId, users, me, runtime]);
}

export function useXUserProfilePosts(userId: string, limit = 80): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  return useMemo(() => {
    if (!userId) return [];
    const filtered: XPost[] = [];
    for (const p of localPosts) {
      if (p.authorId === userId) {
        filtered.push(p);
        if (filtered.length >= limit) break;
      }
    }
    return filtered.map((p) => hydratePost(p, allUsers, postIndex));
  }, [userId, limit, localPosts, allUsers, postIndex]);
}

/**
 * 用户输入搜索 — case-insensitive fuzzy match 是合法例外,
 * id 也走 lowercase 让 "openai" 匹中 id=OpenAI。
 */
export function useXSearchPosts(query: string, limit = 1000): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  return useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^@/, '');
    if (!q) return [];
    const hits: XPost[] = [];
    for (const p of localPosts) {
      const content = (p.content || '').toLowerCase().replace(/\s+/g, ' ');
      const author = allUsers[p.authorId];
      const name = (author?.name || '').toLowerCase();
      const handle = (author?.id || '').toLowerCase();
      if (content.includes(q) || name.includes(q) || handle.includes(q)) {
        hits.push(p);
        if (hits.length >= limit) break;
      }
    }
    return hits.map((p) => hydratePost(p, allUsers, postIndex));
  }, [query, limit, localPosts, allUsers, postIndex]);
}

// ---- Notifications / Conversations / Search history ----

export function useXNotifications(): any[] {
  const allUsers = useXAllUsers();
  return useMemo(
    () =>
      baseNotifications.map((n: any) => {
        const actor = allUsers[n.actorId];
        return {
          ...n,
          actor: {
            id: actor?.id ?? n.actorId,
            name: actor?.name || 'Unknown',
            avatar: actor?.avatar,
          },
        };
      }),
    [allUsers],
  );
}

export function useXMentionNotifications(): any[] {
  const notifications = useXNotifications();
  return useMemo(() => notifications.filter((n) => n.type === 'mention'), [notifications]);
}

export function useXConversations(): any[] {
  const conversations = useXStore(selectConversationsSlice);
  const allUsers = useXAllUsers();
  return useMemo(() => {
    const list = conversations.length > 0 ? conversations : baseConversations;
    return list.map((c) => {
      const participant = allUsers[c.participantId];
      const lastMsg = c.messages[c.messages.length - 1];
      return {
        ...c,
        participant: {
          id: participant?.id ?? c.participantId,
          name: participant?.name || 'Unknown',
          avatar: participant?.avatar,
          verified: participant?.verified,
        },
        lastMessage: {
          ...lastMsg,
          senderUserId: lastMsg.senderId,
          isMe: lastMsg.senderId === currentUser.id,
        },
        messages: c.messages.map((m: XMessage & { isMe?: boolean }) => ({
          ...m,
          senderUserId: m.senderId,
          isMe: m.senderId === currentUser.id,
        })),
      };
    });
  }, [conversations, allUsers]);
}

export function useXRecentSearches(): any[] {
  const allUsers = useXAllUsers();
  return useMemo(
    () =>
      baseSearchHistory.map((h: any) => {
        if (h.type === 'user' && h.userId) {
          return { ...h, user: allUsers[String(h.userId)] };
        }
        return h;
      }),
    [allUsers],
  );
}

// ---- Replies ----

export function useXRepliesForPost(postId: string): XPost[] {
  const index = useXEntityIndex(), users = useXAllUsers();
  return useMemo(() => findXReplyTree(index, postId).map(post => hydrateReplyTree(post, users)), [index, postId, users]);
}

/**
 * 用户 profile -> Replies tab: 收集该 user 在所有 replies 树里的回复,
 * 同时附上 hydrated parent post (从 timeline / 关注流里查).
 */
export function useXUserReplies(userId: string, limit = 80): Array<{ reply: XPost; parent?: any }> {
  const index = useXEntityIndex(), users = useXAllUsers();
  return useMemo(() => {
    if (!userId) return [];
    return [...index.parents].flatMap(([id, parentId]) => {
      const reply = index.posts.get(id), parent = index.posts.get(parentId);
      if (!reply || reply.authorId !== userId) return [];
      return [{ reply: hydrateReplyTree(reply, users), parent: parent ? hydratePost(parent, users, index.posts) : undefined }];
    }).slice(0, limit);
  }, [index, users, userId, limit]);
}
