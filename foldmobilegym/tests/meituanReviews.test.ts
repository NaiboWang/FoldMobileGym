import { describe, expect, it } from 'vitest';
import { filterMeituanReviews, meituanReviewSource, readMeituanReviewFilter } from '../apps/MeituanWaimai/reviewModel';
import type { Shop, ShopReview } from '../apps/MeituanWaimai/types';
const reviews: ShopReview[] = [
  { id: 'a / %', author: 'Source A', text: 'Original A', rating: 5, createdAt: 0 },
  { id: 'b', author: 'Source B', text: 'Original B', rating: 2, createdAt: 2000, images: ['/assets/photo.png'] },
  { id: 'c', author: 'Source C', text: 'Original C', rating: 3, createdAt: 3000 },
  { id: 'd', author: 'Source D', text: 'Original D' },
];
const makeShop = (patch: Partial<Shop> = {}): Shop => ({ id: 'reviews', name: 'Source shop', rating: '1.1', sales: '0', category: 'Food', categoryId: 'food', time: '20', dishes: [], reviews, ...patch });
describe('Meituan review source projection, not merchant aggregate statistics', () => {
  it('distinguishes missing, explicitly empty and malformed sources', () => {
    expect(meituanReviewSource(makeShop({ reviews: undefined }))).toBeUndefined();
    expect(meituanReviewSource(makeShop({ reviews: [] }))).toEqual([]);
    expect(meituanReviewSource(makeShop({ reviews: null as unknown as ShopReview[] }))).toBeNull();
  });
  it('preserves source identities/values without deriving reviews from a merchant rating', () => {
    const shop = makeShop(); expect(meituanReviewSource(shop)).toBe(reviews);
    expect(meituanReviewSource(shop)?.[0].rating).toBe(5);
    expect(meituanReviewSource(shop)?.[0].id).toBe('a / %');
  });
  it('filters source ratings and keeps neutral/missing ratings out of good/bad subsets', () => {
    expect(filterMeituanReviews(reviews, 'positive').map(r => r.id)).toEqual(['a / %']);
    expect(filterMeituanReviews(reviews, 'negative').map(r => r.id)).toEqual(['b']);
    expect(filterMeituanReviews(reviews, 'media').map(r => r.id)).toEqual(['b']);
    expect(filterMeituanReviews(reviews, 'all')).toEqual(reviews);
  });
  it('orders provided timestamps including epoch zero, leaving undated/tied source order stable', () => {
    expect(filterMeituanReviews(reviews, 'latest').map(r => r.id)).toEqual(['c', 'b', 'a / %', 'd']);
    const equal = reviews.map(r => ({ ...r, createdAt: 0 }));
    expect(filterMeituanReviews(equal, 'latest').map(r => r.id)).toEqual(reviews.map(r => r.id));
  });
  it('does not mutate frozen source records/array while filtering or sorting', () => {
    const source = reviews.map(r => Object.freeze({ ...r })); Object.freeze(source);
    const before = JSON.stringify(source);
    for (const f of ['all', 'latest', 'positive', 'negative', 'media'] as const) filterMeituanReviews(source, f);
    expect(JSON.stringify(source)).toBe(before);
  });
  it.each([
    { id: '' }, { author: '' }, { text: ' ' }, { rating: 0 }, { rating: 6 }, { rating: NaN },
    { rating: '5' }, { createdAt: Infinity }, { createdAt: 8640000000000001 }, { createdAt: 'today' },
    { images: 'not-an-array' }, { images: [''] }, { images: [null] }, { avatarImage: 12 }, { merchantReply: {} },
  ])('rejects malformed supplied metadata rather than switching to demo: %j', patch => {
    const source = [{ ...reviews[0], ...patch }] as unknown as ShopReview[];
    expect(meituanReviewSource(makeShop({ reviews: source }))).toBeNull();
  });
  it('rejects duplicate source IDs and sparse records', () => {
    expect(meituanReviewSource(makeShop({ reviews: [reviews[0], reviews[0]] }))).toBeNull();
    expect(meituanReviewSource(makeShop({ reviews: new Array(2) }))).toBeNull();
  });
});
describe('Review filter cold URL identity', () => {
  it('recognizes only the five declared chips and missing default', () => {
    expect(readMeituanReviewFilter('?origin=%2F')).toBe('all');
    for (const f of ['latest', 'positive', 'negative', 'media']) expect(readMeituanReviewFilter('?reviewFilter=' + f)).toBe(f);
  });
  it.each(['?reviewFilter=', '?reviewFilter=all', '?reviewFilter=unknown', '?reviewFilter=negative&reviewFilter=positive', '?reviewFilter=%E0%A4%A'])('does not silently treat malformed/duplicate/unknown values as All: %s', search => {
    expect(readMeituanReviewFilter(search)).toBeNull();
  });
});
