export interface TaobaoCartItem {
  productId: string;
  quantity: number;
  selected: boolean;
  sku: string;
  variantId?: string;
}

interface TaobaoCartProduct {
  price: number;
  variants?: readonly { id: string; price: number }[];
}

export function normalizeTaobaoCart(items: readonly unknown[] | null | undefined): TaobaoCartItem[] {
  return (items ?? []).map(item => typeof item === 'string'
    ? { productId: item, quantity: 1, selected: true, sku: '默认规格' }
    : item as TaobaoCartItem);
}

export function removeSelectedTaobaoCartItems(items: readonly unknown[] | null | undefined): TaobaoCartItem[] {
  return normalizeTaobaoCart(items).filter(item => !item.selected);
}

export function resolveTaobaoCartUnitPrice(product: TaobaoCartProduct, item: TaobaoCartItem): number {
  if (item.variantId) {
    const variant = product.variants?.find(candidate => candidate.id === item.variantId);
    if (variant) return variant.price;
  }
  return product.price;
}
