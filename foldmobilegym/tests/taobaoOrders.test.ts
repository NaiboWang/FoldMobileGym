import { describe, expect, it } from 'vitest';
import { TAOBAO_CONFIG } from '../apps/Taobao/data';
import { filterTaobaoOrders, normalizeTaobaoOrderStatus, TAOBAO_ORDER_STATUSES, type TaobaoOrderRecord } from '../apps/Taobao/orderModel';
import { shouldReplaceTaobaoTransition } from '../apps/Taobao/navigation';

describe('Taobao order model', () => {
  const orders = TAOBAO_CONFIG.orders as TaobaoOrderRecord[];

  it('keeps every simulated order attached to an existing catalog product', () => {
    const productIds = new Set(TAOBAO_CONFIG.products.map(product => product.id));
    expect(new Set(orders.map(order => order.id)).size).toBe(orders.length);
    expect(orders.every(order => productIds.has(order.productId))).toBe(true);
    expect(orders.every(order => order.quantity > 0 && order.paidPrice >= 0)).toBe(true);
  });

  it('normalizes unknown URL states to the all-orders view', () => {
    expect(normalizeTaobaoOrderStatus(null)).toBe('all');
    expect(normalizeTaobaoOrderStatus('unknown')).toBe('all');
    for (const status of TAOBAO_ORDER_STATUSES) expect(normalizeTaobaoOrderStatus(status)).toBe(status);
  });

  it('filters each declared order status without mutating the source list', () => {
    const snapshot = structuredClone(orders);
    expect(filterTaobaoOrders(orders, 'all')).toEqual(orders);
    for (const status of TAOBAO_ORDER_STATUSES.slice(1)) {
      expect(filterTaobaoOrders(orders, status).every(order => order.status === status)).toBe(true);
    }
    expect(orders).toEqual(snapshot);
  });

  it('replaces order filters but preserves push history for entering orders and products', () => {
    expect(shouldReplaceTaobaoTransition('taobao.orders.status.switch')).toBe(true);
    expect(shouldReplaceTaobaoTransition('taobao.tab.cart')).toBe(true);
    expect(shouldReplaceTaobaoTransition('taobao.orders.open')).toBe(false);
    expect(shouldReplaceTaobaoTransition('taobao.product.open')).toBe(false);
  });
});
