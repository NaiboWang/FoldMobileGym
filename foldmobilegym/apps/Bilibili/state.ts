import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import { BILIBILI_CONFIG } from './data';
import type { BilibiliUser, BilibiliSettings } from './types';
import { now as simNow } from '../../os/TimeService';
import { matchesLocalComment, normalizedComment, type CommentDraft, type LocalComment, type LocalCommentLease } from './utils/comments';

// ---- Helpers ----

function deepSet<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: string | boolean,
): T {
  const keys = path.split('.');
  if (keys.length === 1) return { ...obj, [keys[0]!]: value } as T;
  const [head, ...rest] = keys;
  const next =
    obj[head!] != null &&
    typeof obj[head!] === 'object' &&
    !Array.isArray(obj[head!])
      ? (obj[head!] as Record<string, unknown>)
      : {};
  return {
    ...obj,
    [head!]: deepSet(next, rest.join('.'), value),
  } as T;
}

// ---- Types ----

interface BilibiliState {
  user: BilibiliUser;
  activeVideoId: string | null;
  commentDrafts: Record<string, CommentDraft>;
  localComments: Record<string, LocalComment[]>;
  commentReactions: Record<string, 'like' | 'dislike'>;
  settings: BilibiliSettings;
}

interface BilibiliActions {
  // User
  updateUser: (updates: Partial<BilibiliUser>) => void;

  // Settings (persisted with user)
  setSetting: (key: string, value: string | boolean) => void;

  // Active video
  setActiveVideoId: (id: string | null) => void;

  // Follow
  toggleFollow: (id: string | number) => void;

  // Video interactions
  toggleLike: (vid: string) => void;
  toggleDislike: (vid: string) => void;
  addCoin: (vid: string, count: number, alsoLike: boolean) => { success: boolean; msg: string };
  toggleFav: (vid: string) => void;
  /** 批量设置视频在哪些收藏夹中（selectedIds 为选中的收藏夹 id 集合） */
  setFavFolders: (vid: string, selectedIds: string[]) => void;
  /** 新建收藏夹，返回新建的 folder id */
  createFavFolder: (title: string, description?: string, isPublic?: boolean) => string;
  tripleAction: (vid: string) => { success: boolean; msg: string };

  // Anime/Drama subscription
  toggleAnime: (id: string, title?: string) => void;
  toggleDrama: (id: string, title?: string) => void;

  // Search history
  recordVideoVisit: (id: string) => void;
  removeVideoVisit: (id: string) => void;
  addSearchHistory: (keyword: string) => void;
  clearSearchHistory: () => void;
  updateCommentDraft: (key: string, text: string, expected: CommentDraft | undefined) => boolean;
  appendLocalComment: (comment: LocalComment, key: string, expected: CommentDraft, actorId: string) => boolean;
  toggleCommentReaction: (videoId: string, commentId: string, reaction: 'like' | 'dislike') => void;
  updateLocalComment: (videoId: string, commentId: string, actorId: string, text: string, expected: LocalCommentLease | null) => boolean;
  deleteLocalComment: (videoId: string, commentId: string, actorId: string, expected: LocalCommentLease | null) => boolean;
}

// ---- Initial state ----

const initialState: BilibiliState = {
  ...BILIBILI_CONFIG,
  activeVideoId: null,
  settings: BILIBILI_CONFIG.settings,
  commentReactions: {},
};

// ---- Store ----

export const useBilibiliStore = createAppStoreWithActions<BilibiliState, BilibiliActions>(
  'bilibili',
  initialState,
  (set, get) => ({
    // ---- User ----
    updateUser: (updates) => {
      set((state) => ({
        user: { ...state.user, ...updates },
      }));
    },

    // ---- Active video ----
    setActiveVideoId: (id) => {
      set({ activeVideoId: id });
    },

    recordVideoVisit: (id) => {
      if (!id) return;
      const seenAt = simNow();
      set(state => {
        const videoHistory = [id, ...(state.user.videoHistory || []).filter(item => item !== id)].slice(0, 100);
        const prior = state.user.videoHistorySeenAt || {};
        const videoHistorySeenAt = Object.fromEntries(videoHistory.flatMap(item => {
          const time = item === id ? seenAt : prior[item];
          return typeof time === 'number' && Number.isFinite(time) ? [[item, time]] : [];
        }));
        return { user: { ...state.user, videoHistory, videoHistorySeenAt } };
      });
    },

    removeVideoVisit: (id) => {
      set(state => {
        const videoHistorySeenAt = { ...state.user.videoHistorySeenAt };
        delete videoHistorySeenAt[id];
        return { user: { ...state.user, videoHistory: (state.user.videoHistory || []).filter(item => item !== id), videoHistorySeenAt } };
      });
    },

    // ---- Settings ----
    setSetting: (path, value) => {
      set((state) => ({
        settings: deepSet(
          state.settings as unknown as Record<string, unknown>,
          path,
          value,
        ) as unknown as BilibiliSettings,
      }));
    },

    // ---- Follow ----
    toggleFollow: (id) => {
      const mid = String(id);
      set((state) => {
        const currentList = state.user.followingList || [];
        const isFollowing = currentList.some((u) => String(u.mid) === mid);

        let newList;

        if (isFollowing) {
          newList = currentList.filter((u) => String(u.mid) !== mid);
        } else {
          const newEntry = {
            mid,
            name: `用户${mid}`,
            face: '',
            sign: '',
          };
          newList = [...currentList, newEntry];
        }

        return {
          user: {
            ...state.user,
            followingList: newList,
            following: newList.length,
          },
        };
      });
    },


    // ---- Interactions ----

    toggleLike: (vid) => {
      set((state) => {
        const liked = (state.user.likedVideoIds || []).includes(vid);
        const disliked = (state.user.dislikedVideoIds || []).includes(vid);

        let newLiked = [...(state.user.likedVideoIds || [])];
        let newDisliked = [...(state.user.dislikedVideoIds || [])];

        if (liked) {
          newLiked = newLiked.filter((id) => id !== vid);
        } else {
          newLiked.push(vid);
          if (disliked) newDisliked = newDisliked.filter((id) => id !== vid);
        }

        return {
          user: { ...state.user, likedVideoIds: newLiked, dislikedVideoIds: newDisliked },
        };
      });
    },

    toggleDislike: (vid) => {
      set((state) => {
        const liked = (state.user.likedVideoIds || []).includes(vid);
        const disliked = (state.user.dislikedVideoIds || []).includes(vid);

        let newLiked = [...(state.user.likedVideoIds || [])];
        let newDisliked = [...(state.user.dislikedVideoIds || [])];

        if (disliked) {
          newDisliked = newDisliked.filter((id) => id !== vid);
        } else {
          newDisliked.push(vid);
          if (liked) newLiked = newLiked.filter((id) => id !== vid);
        }

        return {
          user: { ...state.user, likedVideoIds: newLiked, dislikedVideoIds: newDisliked },
        };
      });
    },

    addCoin: (vid, count, alsoLike) => {
      const state = get();
      const existing = (state.user.coinedVideoCoins || {})[vid] || 0;

      if (existing + count > 2) {
        return { success: false, msg: '投硬币失败~超过投币上限啦~' };
      }
      if (state.user.coins < count) {
        return { success: false, msg: '硬币不足' };
      }

      set((s) => {
        const coinedVideoCoins = { ...(s.user.coinedVideoCoins || {}), [vid]: existing + count };
        const alreadyLiked = (s.user.likedVideoIds || []).includes(vid);
        return {
          user: {
            ...s.user,
            coins: s.user.coins - count,
            coinedVideoCoins,
            ...(alsoLike && !alreadyLiked ? {
              likedVideoIds: [...(s.user.likedVideoIds || []), vid],
              dislikedVideoIds: (s.user.dislikedVideoIds || []).filter(id => id !== vid),
            } : {}),
          },
        };
      });
      return { success: true, msg: '' };
    },

    toggleFav: (vid) => {
      set((state) => {
        const folders = state.user.favoritesFolders || [];
        const isFavored = folders.some(f => (f.videoIds || []).includes(vid));
        const updatedFolders = isFavored
          ? folders.map(f => ({
              ...f,
              videoIds: (f.videoIds || []).filter(id => id !== vid),
            }))
          : folders.map(f =>
              f.id === 'fav_default'
                ? { ...f, videoIds: [...(f.videoIds || []), vid] }
                : f,
            );

        return {
          user: { ...state.user, favoritesFolders: updatedFolders },
        };
      });
    },

    setFavFolders: (vid, selectedIds) => {
      set((state) => {
        const updatedFolders = (state.user.favoritesFolders || []).map((folder) => {
          const shouldContain = selectedIds.includes(folder.id);
          const currentIds = folder.videoIds || [];
          const alreadyIn = currentIds.includes(vid);
          if (shouldContain && !alreadyIn) {
            return { ...folder, videoIds: [...currentIds, vid] };
          }
          if (!shouldContain && alreadyIn) {
            return { ...folder, videoIds: currentIds.filter((id) => id !== vid) };
          }
          return folder;
        });
        return { user: { ...state.user, favoritesFolders: updatedFolders } };
      });
    },

    createFavFolder: (title, description, isPublic = true) => {
      const base = `fav_${simNow().toString(36)}`;
      const used = new Set((get().user.favoritesFolders || []).map(folder => folder.id));
      let id = base, suffix = 1;
      while (used.has(id)) id = `${base}_${suffix++}`;
      set((state) => ({
        user: {
          ...state.user,
          favoritesFolders: [
            { id, title, isPublic, videoIds: [], ...(description ? { description } : {}) },
            ...(state.user.favoritesFolders || []),
          ],
        },
      }));
      return id;
    },

    tripleAction: (vid) => {
      let msg = '';
      const state = get();
      const liked = (state.user.likedVideoIds || []).includes(vid);
      const coinCount = (state.user.coinedVideoCoins || {})[vid] || 0;
      const isFavored = (state.user.favoritesFolders || []).some(
        (f) => (f.videoIds || []).includes(vid),
      );

      set((s) => {
        let newLiked = [...(s.user.likedVideoIds || [])];
        const newCoinedVideoCoins = { ...(s.user.coinedVideoCoins || {}) };
        let newCoins = s.user.coins;
        let newDisliked = (s.user.dislikedVideoIds || []).filter((id) => id !== vid);

        if (!liked) {
          newLiked.push(vid);
        }
        if (coinCount < 2) {
          if (s.user.coins >= 1) {
            newCoinedVideoCoins[vid] = coinCount + 1;
            newCoins -= 1;
          } else {
            msg = '硬币不足，仅点赞收藏';
          }
        }

        const updatedFolders = !isFavored
          ? (s.user.favoritesFolders || []).map((folder) => {
              if (folder.id === 'fav_default') {
                return { ...folder, videoIds: [...(folder.videoIds || []), vid] };
              }
              return folder;
            })
          : s.user.favoritesFolders;

        return {
          user: {
            ...s.user,
            likedVideoIds: newLiked,
            dislikedVideoIds: newDisliked,
            coinedVideoCoins: newCoinedVideoCoins,
            coins: newCoins,
            favoritesFolders: updatedFolders,
          },
        };
      });

      return { success: true, msg: msg || '三连成功' };
    },

    // ---- Anime/Drama ----
    toggleAnime: (id, title) => {
      set((state) => {
        const subscribed = (state.user.subscribedAnime || []).some((a) => a.id === id);
        return {
          user: {
            ...state.user,
            subscribedAnime: subscribed
              ? (state.user.subscribedAnime || []).filter((a) => a.id !== id)
              : [...(state.user.subscribedAnime || []), { id, title }],
          },
        };
      });
    },

    toggleDrama: (id, title) => {
      set((state) => {
        const subscribed = (state.user.subscribedDramas || []).some((d) => d.id === id);
        return {
          user: {
            ...state.user,
            subscribedDramas: subscribed
              ? (state.user.subscribedDramas || []).filter((d) => d.id !== id)
              : [...(state.user.subscribedDramas || []), { id, title }],
          },
        };
      });
    },

    // Real local publications/drafts; no fixture edits or synthetic success counters.
    updateCommentDraft: (key, text, expected) => {
      let updated=false;
      set(state=>{
        const drafts=state.commentDrafts??{};
        if(drafts[key]!==expected)return state;
        updated=true;
        return {commentDrafts:{...drafts,[key]:{text,revision:(expected?.revision??0)+1}}};
      });
      return updated;
    },
    appendLocalComment: (comment, key, expected, actorId) => {
      let committed=false;
      set(state=>{
        const drafts=state.commentDrafts??{},ledger=state.localComments??{},entries=ledger[comment.videoId]??[];
        if(state.user.uid!==actorId||comment.mid!==actorId||drafts[key]!==expected
          ||entries.some(entry=>entry.rpid===comment.rpid))return state;
        const nextDrafts={...drafts};delete nextDrafts[key];committed=true;
        return {localComments:{...ledger,[comment.videoId]:[comment,...entries]},commentDrafts:nextDrafts};
      });
      return committed;
    },
    toggleCommentReaction: (videoId, commentId, reaction) => {
      const key = `${videoId}:${commentId}`;
      set((state) => {
        const reactions = state.commentReactions ?? {};
        if (reactions[key] === reaction) {
          const next = { ...reactions };
          delete next[key];
          return { commentReactions: next };
        }
        return { commentReactions: { ...reactions, [key]: reaction } };
      });
    },

    updateLocalComment: (videoId, commentId, actorId, text, expected) => {
      let updated = false;
      set((state) => {
        const entries = state.localComments?.[videoId] ?? [];
        const message = normalizedComment(text);
        if (!actorId || state.user.uid !== actorId || !message) return state;
        const targets = entries.filter(entry => entry.rpid === commentId);
        if (targets.length !== 1 || targets[0].videoId !== videoId || !matchesLocalComment(targets[0], expected)) return state;
        const next = entries.map((entry) => {
          if (entry.rpid !== commentId || entry.mid !== actorId) return entry;
          updated = true;
          return { ...entry, message };
        });
        return updated ? { localComments: { ...state.localComments, [videoId]: next } } : state;
      });
      return updated;
    },
    deleteLocalComment: (videoId, commentId, actorId, expected) => {
      let deleted = false;
      set((state) => {
        const entries = state.localComments?.[videoId] ?? [];
        if (!actorId || state.user.uid !== actorId) return state;
        const targets = entries.filter(entry => entry.rpid === commentId);
        if (targets.length !== 1 || targets[0].videoId !== videoId || !matchesLocalComment(targets[0], expected)) return state;
        const next = entries.filter((entry) => {
          const keep = entry.rpid !== commentId || entry.mid !== actorId;
          if (!keep) deleted = true;
          return keep;
        });
        return deleted ? { localComments: { ...state.localComments, [videoId]: next } } : state;
      });
      return deleted;
    },

    // ---- Search history ----
    addSearchHistory: (keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;
      set((state) => {
        const history = state.user.searchHistory || [];
        const newHistory = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, 10);
        return {
          user: { ...state.user, searchHistory: newHistory },
        };
      });
    },

    clearSearchHistory: () => {
      set((state) => ({
        user: { ...state.user, searchHistory: [] },
      }));
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        if (k === 'activeVideoId') continue;
        result[k] = v;
      }
      return result as Partial<BilibiliState>;
    },
  },
);

// ---- Memoized Selectors ----

type BilibiliStore = BilibiliState & BilibiliActions;

export const selectUser = (s: BilibiliStore) => s.user;

export const selectSearchHistory = memoSelector(
  (s: BilibiliStore) => s.user.searchHistory,
  (history) => history || [],
);
