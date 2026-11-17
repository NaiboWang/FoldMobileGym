import { describe, expect, it } from 'vitest';
import { resolveTaobaoCartUnitPrice } from '../apps/Taobao/cartModel';
import { TAOBAO_CONFIG } from '../apps/Taobao/data';
import { clampTaobaoSkuQuantity, formatTaobaoVariant, resolveTaobaoSkuSelection, taobaoProductVariants } from '../apps/Taobao/skuModel';

describe('Taobao detail SKU model', () => {
  const monitor = TAOBAO_CONFIG.products.find(product => product.id === 'portable_monitor_x1')!;
  const phone = TAOBAO_CONFIG.products.find(product => product.id === 'phone')!;

  it('uses only declared local variants and falls back to the first declared option', () => {
    const variants = taobaoProductVariants(monitor);
    expect(variants.map(item => item.id)).toEqual(['x1_13', 'x1_15']);
    expect(resolveTaobaoSkuSelection(monitor, 'x1_15')).toEqual({
      variantId: 'x1_15',
      sku: '15.6英寸；2.5K；780g',
      price: 1299,
    });
    expect(resolveTaobaoSkuSelection(monitor, 'not-declared')).toEqual({
      variantId: 'x1_13',
      sku: '13.3英寸；1080P；580g',
      price: 899,
    });
    expect(formatTaobaoVariant(variants[0])).toBe('13.3英寸；1080P；580g');
  });

  it('uses an explicit default option without inventing variants', () => {
    expect(taobaoProductVariants(phone)).toEqual([]);
    expect(resolveTaobaoSkuSelection(phone, 'invented')).toEqual({ sku: '默认规格', price: 4299 });
  });

  it('bounds requested quantities and resolves variant-aware cart prices', () => {
    expect(clampTaobaoSkuQuantity(-5)).toBe(1);
    expect(clampTaobaoSkuQuantity(2.4)).toBe(2);
    expect(clampTaobaoSkuQuantity(120)).toBe(99);
    expect(clampTaobaoSkuQuantity(Number.NaN)).toBe(1);
    expect(resolveTaobaoCartUnitPrice(monitor, { productId: monitor.id, quantity: 2, selected: true, sku: '15.6英寸；2.5K；780g', variantId: 'x1_15' })).toBe(1299);
    expect(resolveTaobaoCartUnitPrice(monitor, { productId: monitor.id, quantity: 1, selected: true, sku: '旧数据', variantId: 'missing' })).toBe(899);
  });
});
