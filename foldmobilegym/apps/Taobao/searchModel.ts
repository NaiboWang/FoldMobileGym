export type TaobaoSearchSort = 'default' | 'sales';

interface SearchableTaobaoProduct {
  title: string;
  shop: string;
  tag: string;
  sold: number;
}

export function normalizeTaobaoSearchSort(value: string | null | undefined): TaobaoSearchSort {
  return value === 'sales' ? 'sales' : 'default';
}

export function filterAndSortTaobaoProducts<T extends SearchableTaobaoProduct>(
  products: readonly T[],
  query: string,
  sort: TaobaoSearchSort,
): T[] {
  const term = query.trim().toLocaleLowerCase();
  const filtered = term
    ? products.filter(product => `${product.title}${product.shop}${product.tag}`.toLocaleLowerCase().includes(term))
    : [...products];

  if (sort === 'default') return filtered;
  return filtered
    .map((product, index) => ({ product, index }))
    .sort((left, right) => right.product.sold - left.product.sold || left.index - right.index)
    .map(item => item.product);
}
