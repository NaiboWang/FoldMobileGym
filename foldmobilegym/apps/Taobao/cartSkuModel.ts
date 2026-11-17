import type { TaobaoCartItem } from './cartModel';
import { formatTaobaoVariant, taobaoProductVariants, type TaobaoSkuProduct } from './skuModel';

export interface TaobaoCartSkuSource<T extends TaobaoSkuProduct & { id: string }> {
  product: T;
  rawItem: TaobaoCartItem | string;
  row: TaobaoCartItem;
  cart: readonly unknown[];
}
const productIdOf = (item: unknown): unknown => typeof item === 'string' ? item
  : item && typeof item === 'object' && 'productId' in item ? item.productId : undefined;

export function captureTaobaoCartSku<T extends TaobaoSkuProduct & { id: string }>(
  products: readonly T[], cart: readonly unknown[], productId: string): TaobaoCartSkuSource<T> | null {
  const productMatches = products.filter(product => product.id === productId);
  const rows = cart.filter(item => productIdOf(item) === productId);
  if (!productId || productMatches.length !== 1 || rows.length !== 1) return null;
  const rawItem = rows[0] as TaobaoCartItem | string;
  return { product: productMatches[0], rawItem, cart,
    row: typeof rawItem === 'string' ? { productId, quantity: 1, selected: true, sku: '默认规格' } : rawItem };
}

export function taobaoCartSkuSourceIsCurrent<T extends TaobaoSkuProduct & { id: string }>(
  products: readonly T[], cart: readonly unknown[], source: TaobaoCartSkuSource<T>): boolean {
  const current = captureTaobaoCartSku(products, cart, source.product.id);
  return !!current && current.product === source.product && current.rawItem === source.rawItem
    && (typeof source.rawItem !== 'string' || cart === source.cart);
}

export function initialTaobaoCartVariant(source: TaobaoCartSkuSource<TaobaoSkuProduct & { id: string }>): string | undefined {
  const variants = taobaoProductVariants(source.product);
  const matches = source.row.variantId ? variants.filter(variant => variant.id === source.row.variantId)
    : variants.filter(variant => formatTaobaoVariant(variant) === source.row.sku);
  return matches.length === 1 ? matches[0].id : undefined;
}

/** Explicit save only. Unknown options never silently become the first variant. */
export function nextTaobaoCartSku(source: TaobaoCartSkuSource<TaobaoSkuProduct & { id: string }>,
  variantId: string | undefined, quantity: number): TaobaoCartItem | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  const variants = taobaoProductVariants(source.product);
  if (!variants.length) {
    if (variantId !== undefined && variantId !== source.row.variantId) return null;
    return { ...source.row, quantity }; // retain the cart's known SKU, not an invented default
  }
  const matches = variants.filter(variant => variant.id === variantId);
  if (matches.length !== 1 || !Number.isFinite(matches[0].price) || matches[0].price < 0) return null;
  return { ...source.row, quantity, variantId: matches[0].id, sku: formatTaobaoVariant(matches[0]) };
}

export function taobaoCartSkuParent(search: string): string {
  const query = new URLSearchParams(search); query.delete('sheet'); query.delete('productId');
  return '/cart' + (query.size ? `?${query}` : '');
}
export function hasTaobaoCartSkuParent(search: string, previous?: { pathname: string; search: string }): boolean {
  if (previous?.pathname !== '/cart') return false;
  const expected = new URLSearchParams(search); expected.delete('sheet'); expected.delete('productId'); expected.sort();
  const actual = new URLSearchParams(previous.search); actual.sort();
  return expected.toString() === actual.toString();
}
