export interface Dish {
  id: string;
  name: string;
  price: number;
  note: string;
  emoji: string;
  image?: string;
  categoryId?: string;
}

/** Optional source records; no review data is inferred from a merchant rating. */
export interface ShopReview {
  id: string;
  author: string;
  text: string;
  rating?: number;
  createdAt?: number;
  avatarImage?: string;
  images?: string[];
  merchantReply?: string;
}

export interface Shop {
  id: string;
  name: string;
  rating: string;
  sales: string;
  category: string;
  categoryId: 'food' | 'drinks' | 'market';
  time: string;
  reviews?: ShopReview[];
  coverImage?: string;
  logoImage?: string;
  menuCategories?: { id: string; name: string }[];
  dishes: Dish[];
}

export type ShopOverlays = Record<string, Shop | null | undefined>;
