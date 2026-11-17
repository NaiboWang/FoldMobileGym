import { beforeEach, describe, expect, it } from 'vitest';
import { useMeituanStore } from '../apps/MeituanWaimai/state';
import { resolveMeituanShops } from '../apps/MeituanWaimai/data';

const rice = resolveMeituanShops().find(shop => shop.id === 'rice')!;
const tea = resolveMeituanShops().find(shop => shop.id === 'tea')!;
const chickenName = rice.dishes.find(dish => dish.id === 'chicken')!.name;

describe('Meituan simulated checkout', () => {
  beforeEach(() => useMeituanStore.setState({ shops: {}, user: { orderIds: [] },
    orders: {}, nextOrderNumber: 1, cart: { shopId: 'rice', quantities: {} } }));

  it('rejects unknown shops and dishes without clearing the current cart', () => {
    useMeituanStore.setState({ cart: { shopId: 'rice', quantities: { chicken: 2 } } });
    useMeituanStore.getState().selectShop('missing');
    useMeituanStore.getState().changeCartItem('missing', 'chicken', 1);
    useMeituanStore.getState().changeCartItem('rice', 'missing', 1);
    expect(useMeituanStore.getState().cart).toEqual({ shopId: 'rice', quantities: { chicken: 2 } });
  });

  it('rejects mismatched names and prices using the displayed catalog', () => {
    useMeituanStore.setState({ cart: { shopId: 'rice', quantities: { chicken: 1 } } });
    const item = { dishId: 'chicken', name: chickenName, quantity: 1, unitPrice: 24.8 };
    for (const changed of [{ ...item, unitPrice: 0.01 }, { ...item, name: 'Other dish' }]) {
      expect(useMeituanStore.getState().createOrder('rice', rice.name, [changed])).toBeNull();
    }
    expect(useMeituanStore.getState().createOrder('rice', 'Other shop', [item])).toBeNull();
    expect(useMeituanStore.getState().orders).toEqual({});
    expect(useMeituanStore.getState().cart.quantities).toEqual({ chicken: 1 });
  });
  it('preserves stale cart data but refuses actions and checkout for a hidden shop', () => {
    useMeituanStore.setState({ shops: { rice: null }, cart: { shopId: 'rice', quantities: { chicken: 2 } } });
    useMeituanStore.getState().changeCartItem('rice', 'chicken', 1);
    expect(useMeituanStore.getState().createOrder('rice', rice.name,
      [{ dishId: 'chicken', name: chickenName, quantity: 2, unitPrice: 24.8 }])).toBeNull();
    expect(useMeituanStore.getState().cart).toEqual({ shopId: 'rice', quantities: { chicken: 2 } });
    expect(useMeituanStore.getState().orders).toEqual({});
  });
  it('rejects a malformed extra cart entry even when the submitted items match positive quantities', () => {
    useMeituanStore.setState({ cart: { shopId: 'rice', quantities: { chicken: 1, removed: 0 } } });
    expect(useMeituanStore.getState().createOrder('rice', rice.name,
      [{ dishId: 'chicken', name: chickenName, quantity: 1, unitPrice: 24.8 }])).toBeNull();
    expect(useMeituanStore.getState().cart.quantities).toEqual({ chicken: 1, removed: 0 });
    expect(useMeituanStore.getState().orders).toEqual({});
  });
  it('ignores invalid quantity changes without damaging the cart', () => {
    useMeituanStore.setState({
      user: { orderIds: [] }, orders: {}, nextOrderNumber: 1,
      cart: { shopId: 'rice', quantities: { chicken: 2 } },
    });
    for (const amount of [NaN, Infinity, -Infinity, 0.5, 0, Number.MAX_SAFE_INTEGER]) {
      useMeituanStore.getState().changeCartItem('rice', 'chicken', amount);
      expect(useMeituanStore.getState().cart).toEqual({ shopId: 'rice', quantities: { chicken: 2 } });
    }
    useMeituanStore.getState().changeCartItem('tea', 'mango', -1);
    expect(useMeituanStore.getState().cart).toEqual({ shopId: 'rice', quantities: { chicken: 2 } });
  });
  it('requires explicit shop selection before replacing a nonempty cart', () => {
    useMeituanStore.setState({ cart: { shopId: 'rice', quantities: { chicken: 2 } } });
    useMeituanStore.getState().changeCartItem('tea', 'mango', 1);
    expect(useMeituanStore.getState().cart).toEqual({ shopId: 'rice', quantities: { chicken: 2 } });
    useMeituanStore.getState().selectShop('tea');
    expect(useMeituanStore.getState().cart).toEqual({ shopId: 'tea', quantities: {} });
    useMeituanStore.getState().changeCartItem('tea', 'mango', 1);
    expect(useMeituanStore.getState().cart).toEqual({ shopId: 'tea', quantities: { mango: 1 } });
  });
  it('allows adding to another shop when the previous cart is truly empty', () => {
    useMeituanStore.getState().changeCartItem('tea', 'mango', 1);
    expect(useMeituanStore.getState().cart).toEqual({ shopId: 'tea', quantities: { mango: 1 } });
  });

  it('supports integer additions and removals while deleting zero entries', () => {
    useMeituanStore.setState({ cart: { shopId: 'rice', quantities: { chicken: 2 } } });
    useMeituanStore.getState().changeCartItem('rice', 'chicken', 1);
    expect(useMeituanStore.getState().cart.quantities.chicken).toBe(3);
    useMeituanStore.getState().changeCartItem('rice', 'chicken', -3);
    expect(useMeituanStore.getState().cart.quantities).toEqual({});
  });
  it('rejects duplicated dish IDs and omitted cart items without mutation', () => {
    useMeituanStore.setState({
      user: { orderIds: [] }, orders: {}, nextOrderNumber: 1,
      cart: { shopId: 'rice', quantities: { chicken: 1, beef: 1 } },
    });
    const chicken = { dishId: 'chicken', name: chickenName, quantity: 1, unitPrice: 24.8 };
    expect(useMeituanStore.getState().createOrder('rice', rice.name, [chicken, chicken])).toBeNull();
    expect(useMeituanStore.getState().createOrder('rice', rice.name, [chicken])).toBeNull();
    expect(useMeituanStore.getState().cart.quantities).toEqual({ chicken: 1, beef: 1 });
    expect(useMeituanStore.getState().nextOrderNumber).toBe(1);
    expect(useMeituanStore.getState().orders).toEqual({});
  });

  it('computes decimal prices in integer cents', () => {
    useMeituanStore.setState({
      shops: { test: { id: 'test', name: 'Test', categoryId: 'food', category: 'Food',
        rating: '4.8', sales: '100', time: '20', dishes: [
          { id: 'a', name: 'A', price: 0.1, note: '', emoji: '🍱' },
          { id: 'b', name: 'B', price: 0.2, note: '', emoji: '🍱' },
        ] } },
      user: { orderIds: [] }, orders: {}, nextOrderNumber: 1,
      cart: { shopId: 'test', quantities: { a: 3, b: 1 } },
    });
    useMeituanStore.getState().createOrder('test', 'Test', [
      { dishId: 'a', name: 'A', quantity: 3, unitPrice: 0.1 },
      { dishId: 'b', name: 'B', quantity: 1, unitPrice: 0.2 },
    ]);
    expect(useMeituanStore.getState().orders.demo_order_001.total).toBe(0.5);
  });
  it('creates one order and empties the cart atomically on repeated taps', () => {
    useMeituanStore.setState({
      user: { orderIds: [] }, orders: {}, nextOrderNumber: 1,
      cart: { shopId: 'rice', quantities: { chicken: 2 } },
    });
    const items = [{ dishId: 'chicken', name: chickenName, quantity: 2, unitPrice: 24.8 }];
    const first = useMeituanStore.getState().createOrder('rice', rice.name, items);
    const second = useMeituanStore.getState().createOrder('rice', rice.name, items);
    const state = useMeituanStore.getState();
    expect(first).toBe('demo_order_001');
    expect(second).toBeNull();
    expect(state.user.orderIds).toEqual(['demo_order_001']);
    expect(state.orders.demo_order_001.total).toBe(49.6);
    expect(state.cart.quantities).toEqual({});
    expect(state.nextOrderNumber).toBe(2);
  });

  it('rejects stale quantities or a different shop', () => {
    useMeituanStore.setState({
      user: { orderIds: [] }, orders: {}, nextOrderNumber: 3,
      cart: { shopId: 'tea', quantities: { mango: 1 } },
    });
    const item = [{ dishId: 'mango', name: tea.dishes.find(dish => dish.id === 'mango')!.name, quantity: 1, unitPrice: 19.8 }];
    expect(useMeituanStore.getState().createOrder('rice', rice.name, item)).toBeNull();
    expect(useMeituanStore.getState().createOrder('tea', tea.name, [{ ...item[0], quantity: 2 }])).toBeNull();
    expect(useMeituanStore.getState().user.orderIds).toEqual([]);
    expect(useMeituanStore.getState().cart.quantities).toEqual({ mango: 1 });
  });
});
