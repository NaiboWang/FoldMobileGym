import type { Shop, ShopReview } from './types';

export type MeituanReviewFilter = 'all' | 'latest' | 'positive' | 'negative' | 'media';

/** Missing data preserves the explicitly labeled legacy demo; invalid is not missing. */
export function meituanReviewSource(shop: Shop): ShopReview[] | null | undefined {
  if (shop.reviews === undefined) return undefined;
  if (!Array.isArray(shop.reviews)) return null;
  const ids = new Set<string>();
  for (const review of shop.reviews) {
    if (!review || typeof review.id !== 'string' || !review.id || ids.has(review.id)
      || typeof review.author !== 'string' || !review.author.trim()
      || typeof review.text !== 'string' || !review.text.trim()
      || (review.rating !== undefined && (typeof review.rating !== 'number' || !Number.isFinite(review.rating) || review.rating < 1 || review.rating > 5))
      || (review.createdAt !== undefined && (typeof review.createdAt !== 'number' || !Number.isFinite(review.createdAt) || Math.abs(review.createdAt) > 8640000000000000))
      || (review.images !== undefined && (!Array.isArray(review.images) || review.images.some(image => typeof image !== 'string' || !image.trim())))
      || (review.avatarImage !== undefined && typeof review.avatarImage !== 'string')
      || (review.merchantReply !== undefined && typeof review.merchantReply !== 'string')) return null;
    ids.add(review.id);
  }
  return shop.reviews;
}

/** Reject duplicate/unknown URL values instead of silently selecting another chip. */
export function readMeituanReviewFilter(search: string): MeituanReviewFilter | null {
  const values = new URLSearchParams(search).getAll('reviewFilter');
  if (!values.length) return 'all';
  if (values.length !== 1) return null;
  const value = values[0];
  return value === 'latest' || value === 'positive' || value === 'negative' || value === 'media' ? value : null;
}

/** Derive the visible subset/order without writing counts or sorting the source array. */
export function filterMeituanReviews(reviews: readonly ShopReview[], filter: MeituanReviewFilter): ShopReview[] {
  if (filter === 'positive') return reviews.filter(r => r.rating !== undefined && r.rating >= 4);
  if (filter === 'negative') return reviews.filter(r => r.rating !== undefined && r.rating <= 2);
  if (filter === 'media') return reviews.filter(r => Boolean(r.images?.length));
  if (filter === 'latest') return [...reviews].sort((a, b) => {
    if (a.createdAt === undefined) return b.createdAt === undefined ? 0 : 1;
    if (b.createdAt === undefined) return -1;
    return b.createdAt - a.createdAt;
  });
  return [...reviews];
}
