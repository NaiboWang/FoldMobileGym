import type { Comment, RedditSettings } from '../types';

export function sortCommentsForPreference(
  comments: Comment[],
  preference: RedditSettings['defaultCommentSort'],
): Comment[] {
  const time = (comment: Comment) => comment.created_utc ?? 0;
  const score = (comment: Comment) => comment.score ?? 0;
  return [...comments].sort((a, b) => {
    if (preference === 'new') return time(b) - time(a) || a.id.localeCompare(b.id);
    if (preference === 'top' || preference === 'qa') {
      return score(b) - score(a) || time(b) - time(a) || a.id.localeCompare(b.id);
    }
    if (preference === 'controversial') {
      // The fixture only provides net score, not separate up/down vote totals.
      return Math.abs(score(a)) - Math.abs(score(b)) || time(b) - time(a) || a.id.localeCompare(b.id);
    }
    // Preserve the established order for Best/Old by default.
    return time(a) - time(b) || a.id.localeCompare(b.id);
  });
}
