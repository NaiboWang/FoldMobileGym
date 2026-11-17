export interface TaobaoProductVariant {
  id: string;
  size: string;
  resolution: string;
  weight: string;
  price: number;
}

export interface TaobaoSkuProduct {
  price: number;
  variants?: readonly TaobaoProductVariant[];
}

export interface TaobaoSkuSelection {
  variantId?: string;
  sku: string;
  price: number;
}

export function taobaoProductVariants(product: TaobaoSkuProduct): readonly TaobaoProductVariant[] {
  return Array.isArray(product.variants) ? product.variants : [];
}

export function formatTaobaoVariant(variant: TaobaoProductVariant): string {
  return `${variant.size}；${variant.resolution}；${variant.weight}`;
}

export function resolveTaobaoSkuSelection(product: TaobaoSkuProduct, requestedVariantId?: string | null): TaobaoSkuSelection {
  const variants = taobaoProductVariants(product);
  if (!variants.length) return { sku: '默认规格', price: product.price };
  const variant = variants.find(item => item.id === requestedVariantId) ?? variants[0];
  return { variantId: variant.id, sku: formatTaobaoVariant(variant), price: variant.price };
}

export function clampTaobaoSkuQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(99, Math.round(quantity)));
}
