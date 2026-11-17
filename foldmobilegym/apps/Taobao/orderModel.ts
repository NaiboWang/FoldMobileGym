export const TAOBAO_ORDER_STATUSES = [
  'all',
  'pendingPay',
  'pendingShip',
  'pendingReceive',
  'afterSale',
  'pendingReview',
  'closed',
] as const;

export type TaobaoOrderStatus = (typeof TAOBAO_ORDER_STATUSES)[number];
export type TaobaoStoredOrderStatus = Exclude<TaobaoOrderStatus, 'all'>;

export interface TaobaoOrderRecord {
  id: string;
  productId: string;
  status: TaobaoStoredOrderStatus;
  quantity: number;
  paidPrice: number;
}

export function normalizeTaobaoOrderStatus(value: string | null | undefined): TaobaoOrderStatus {
  return TAOBAO_ORDER_STATUSES.includes(value as TaobaoOrderStatus)
    ? value as TaobaoOrderStatus
    : 'all';
}

export function filterTaobaoOrders<T extends { status: TaobaoStoredOrderStatus }>(
  orders: readonly T[],
  status: TaobaoOrderStatus,
): T[] {
  return status === 'all' ? [...orders] : orders.filter(order => order.status === status);
}
