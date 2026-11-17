import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
import defaults from './data/defaults.json';
import type { ShopOverlays } from './types';
import { resolveMeituanShops } from './data';
import { summarizeMeituanCart } from './cartSummary';

export interface DemoOrderItem {
  dishId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface DemoOrder {
  id: string;
  shopId: string;
  shopName: string;
  items: DemoOrderItem[];
  total: number;
  status: 'simulated';
}

interface MeituanState {
  shops: ShopOverlays;
  user: { orderIds: string[] };
  orders: Record<string, DemoOrder>;
  nextOrderNumber: number;
  cart: { shopId: string; quantities: Record<string, number> };
}

interface MeituanActions {
  createOrder: (shopId: string, shopName: string, items: DemoOrderItem[]) => string | null;
  selectShop: (shopId: string) => void;
  changeCartItem: (shopId: string, dishId: string, amount: number) => void;
  clearCart: () => void;
}

const initialState: MeituanState = {
  shops: {},
  user: { orderIds: [...defaults.user.orderIds] },
  orders: { ...defaults.orders },
  nextOrderNumber: defaults.nextOrderNumber,
  cart: { shopId: defaults.cart.shopId, quantities: { ...defaults.cart.quantities } },
};

export const useMeituanStore = createAppStoreWithActions<MeituanState, MeituanActions>(
  'meituan_waimai',
  initialState,
  (set) => ({
    selectShop: (shopId) => set((state) => state.cart.shopId === shopId ||
      !resolveMeituanShops(state.shops).some(shop => shop.id === shopId) ? state : {
      cart: { shopId, quantities: {} },
    }),
    changeCartItem: (shopId, dishId, amount) => set((state) => {
      // Invalid/stale actions must not corrupt persisted quantities or switch
      // away from another shop's cart. Normal UI increments are integers.
      if (!shopId || !dishId || !Number.isSafeInteger(amount) || amount === 0 ||
        (state.cart.shopId !== shopId && (amount < 0 || Object.keys(state.cart.quantities).length > 0))) return state;
      const shop = resolveMeituanShops(state.shops).find(item => item.id === shopId);
      if (!shop?.dishes.some(dish => dish.id === dishId)) return state;
      const quantities = state.cart.shopId === shopId ? state.cart.quantities : {};
      const currentQuantity = quantities[dishId] ?? 0;
      if (!Number.isSafeInteger(currentQuantity) || currentQuantity < 0) return state;
      const sum = currentQuantity + amount;
      if (!Number.isSafeInteger(sum)) return state;
      const nextQuantity = Math.max(0, sum);
      const nextQuantities = { ...quantities };
      if (nextQuantity === 0) delete nextQuantities[dishId];
      else nextQuantities[dishId] = nextQuantity;
      return { cart: { shopId, quantities: nextQuantities } };
    }),
    clearCart: () => set((state) => ({ cart: { ...state.cart, quantities: {} } })),
    createOrder: (shopId, shopName, items) => {
      let createdId: string | null = null;
      set((state) => {
        // Validate against the current cart inside the same update. A second tap
        // sees the emptied cart and cannot create a duplicate simulated order.
        const cartIds = Object.keys(state.cart.quantities).filter(id => state.cart.quantities[id] > 0);
        const itemIds = new Set(items.map(item => item.dishId));
        const shop = resolveMeituanShops(state.shops).find(item => item.id === shopId);
        if (!summarizeMeituanCart(state.cart, resolveMeituanShops(state.shops)).valid) return state;
        if (!shop || shop.name !== shopName || state.cart.shopId !== shopId || items.length === 0 ||
          itemIds.size !== items.length || items.length !== cartIds.length ||
          !cartIds.every(id => itemIds.has(id)) || !items.every((item) => {
          const dish = shop.dishes.find(entry => entry.id === item.dishId);
          return dish && dish.name === item.name && dish.price === item.unitPrice &&
          Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
          Number.isFinite(item.unitPrice) && item.unitPrice >= 0 &&
          state.cart.quantities[item.dishId] === item.quantity;
        })) return state;
        const totalCents = items.reduce((sum, item) => sum + Math.round(item.unitPrice * 100) * item.quantity, 0);
        if (!Number.isSafeInteger(totalCents)) return state;
        // Imported or restored state can have a stale counter. Never overwrite
        // an existing order or reuse an ID still referenced by order history.
        if (!Number.isSafeInteger(state.nextOrderNumber) || state.nextOrderNumber < 1) return state;
        const occupied = new Set([...Object.keys(state.orders), ...state.user.orderIds]);
        let sequence = state.nextOrderNumber;
        let id = `demo_order_${String(sequence).padStart(3, '0')}`;
        while (occupied.has(id) && sequence < Number.MAX_SAFE_INTEGER) {
          sequence += 1;
          id = `demo_order_${String(sequence).padStart(3, '0')}`;
        }
        // The next persisted counter must also remain a safe integer.
        if (sequence >= Number.MAX_SAFE_INTEGER) return state;
        const order: DemoOrder = {
          id,
          shopId,
          shopName,
          items: items.map((item) => ({ ...item })),
          total: totalCents / 100,
          status: 'simulated',
        };
        createdId = id;
        return {
          orders: { ...state.orders, [id]: order },
          user: { ...state.user, orderIds: [id, ...state.user.orderIds] },
          nextOrderNumber: sequence + 1,
          cart: { ...state.cart, quantities: {} },
        };
      });
      return createdId;
    },
  }),
);

// Private snapshot projection only: no duplicated totals in persistent state.
registerStateAdapter('meituan_waimai', (state: MeituanState) => ({
  ...state,
  cart_summary: summarizeMeituanCart(state.cart, resolveMeituanShops(state.shops)),
}));
