import { useMemo } from 'react';
import { useRedditStore } from '../state';
import type { Comment } from '../types';
import { useRedditPostById } from './useRedditPosts';
import { resolvePostComments } from '../utils/search';

function isComment(value: Comment | null | undefined): value is Comment {
  return Boolean(value);
}

export function useRedditComments(postId: string | null | undefined): Comment[] {
  const post = useRedditPostById(postId);
  const commentsTable = useRedditStore((state) => state.comments);

  return useMemo(() => {
    return resolvePostComments(post, commentsTable);
  }, [post, commentsTable]);
}

export function useMyRedditComments(): Comment[] {
  const commentsTable = useRedditStore((state) => state.comments);
  const commentIds = useRedditStore((state) => state.user.commentIds);

  return useMemo(
    () => commentIds
      .map((id) => commentsTable[id])
      .filter(isComment)
      .sort((a, b) => (b.created_utc ?? 0) - (a.created_utc ?? 0)),
    [commentIds, commentsTable],
  );
}
