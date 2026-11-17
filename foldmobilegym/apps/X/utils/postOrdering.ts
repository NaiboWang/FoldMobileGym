import type { XPost } from '../types';
import { compareXPostsByRecencyDesc } from './formatTime';

export function orderXReplies<T extends XPost>(rows: readonly T[], method: 'relevant' | 'recent' | 'likes'): T[] {
  const result = [...rows];
  if (method === 'recent') result.sort(compareXPostsByRecencyDesc);
  else if (method === 'likes') result.sort((a, b) => b.stats.likes - a.stats.likes);
  return result;
}
export function orderXQuotes<T extends XPost>(rows: readonly T[], method: 'popular' | 'recent'): T[] {
  return [...rows].sort(method === 'recent' ? compareXPostsByRecencyDesc : (a, b) => b.stats.likes - a.stats.likes);
}
