import { ClipboardService } from '@/os/ClipboardService';
import type { Comment, RedditPost } from '../types';

export type ShareCopyKind = 'link' | 'text';

function validPostUrl(post: RedditPost): string | null {
  const raw = post.url?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function copyPostShare(post: RedditPost): ShareCopyKind {
  const url = validPostUrl(post);
  ClipboardService.copyText(url ?? post.title, 'Reddit');
  return url ? 'link' : 'text';
}

export function copyCommentShare(post: RedditPost | undefined, comment: Comment): ShareCopyKind {
  const url = post ? validPostUrl(post) : null;
  // A comment permalink is only generated when the fixture provides a real post URL.
  const permalink = url ? `${url.replace(/\/$/, '')}/${encodeURIComponent(comment.id)}/` : null;
  ClipboardService.copyText(permalink ?? comment.body, 'Reddit');
  return permalink ? 'link' : 'text';
}
