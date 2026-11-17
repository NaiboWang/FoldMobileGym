import { describe, expect, it } from 'vitest';
import { ClipboardService } from '../os/ClipboardService';
import { copyCommentShare, copyPostShare } from '../apps/Reddit/utils/share';
import type { RedditPost, Comment } from '../apps/Reddit/types';

const post: RedditPost = {
  id: 'p1', subreddit: 'r/test', author: 'test', timeAgo: 'now', title: 'Local title',
  upvotes: '1', comments: '1', url: 'https://www.reddit.com/r/test/comments/p1/title/',
};
const comment: Comment = { id: 'c1', postId: 'p1', author: 'test', body: 'Local comment' };

describe('Reddit simulated share', () => {
  it('copies a fixture post URL and a comment permalink', () => {
    expect(copyPostShare(post)).toBe('link');
    expect(ClipboardService.getState().current?.content).toBe(post.url);
    expect(copyCommentShare(post, comment)).toBe('link');
    expect(ClipboardService.getState().current?.content).toBe(`${post.url}c1/`);
  });

  it('copies local content when no actual URL exists', () => {
    expect(copyPostShare({ ...post, url: undefined })).toBe('text');
    expect(ClipboardService.getState().current?.content).toBe('Local title');
    expect(copyCommentShare(undefined, comment)).toBe('text');
    expect(ClipboardService.getState().current?.content).toBe('Local comment');
  });
});
