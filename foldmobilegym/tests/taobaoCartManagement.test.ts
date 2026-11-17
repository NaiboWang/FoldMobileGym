import { describe, expect, it } from 'vitest';
import { normalizeTaobaoCart, removeSelectedTaobaoCartItems } from '../apps/Taobao/cartModel';

describe('Taobao cart management model', () => {
  it('normalizes legacy string entries before management mutations', () => {
    expect(normalizeTaobaoCart(['phone'])).toEqual([
      { productId: 'phone', quantity: 1, selected: true, sku: '默认规格' },
    ]);
  });

  it('removes only selected entries without mutating the source array', () => {
    const source = [
      { productId: 'phone', quantity: 1, selected: true, sku: '黑色' },
      { productId: 'watch', quantity: 2, selected: false, sku: '灰色' },
      { productId: 'bag', quantity: 1, selected: true, sku: '棕色' },
    ];
    const snapshot = structuredClone(source);
    expect(removeSelectedTaobaoCartItems(source)).toEqual([
      { productId: 'watch', quantity: 2, selected: false, sku: '灰色' },
    ]);
    expect(source).toEqual(snapshot);
  });

  it('returns an empty cart when every item is selected and tolerates missing data', () => {
    expect(removeSelectedTaobaoCartItems(['phone', 'bag'])).toEqual([]);
    expect(removeSelectedTaobaoCartItems(undefined)).toEqual([]);
  });
});
