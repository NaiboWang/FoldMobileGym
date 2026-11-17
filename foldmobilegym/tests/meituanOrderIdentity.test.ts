import { beforeEach, describe, expect, it } from 'vitest';
import { useMeituanStore } from '../apps/MeituanWaimai/state';
import { resolveMeituanShops } from '../apps/MeituanWaimai/data';

const shop=resolveMeituanShops().find(item=>item.id==='rice')!;
const dish=shop.dishes.find(item=>item.id==='chicken')!;
const existing={id:'demo_order_001',shopId:'old',shopName:'Existing',items:[],total:12,status:'simulated' as const};
const item={dishId:dish.id,name:dish.name,quantity:1,unitPrice:dish.price};
describe('Meituan simulated order identity',()=>{
  beforeEach(()=>useMeituanStore.setState({shops:{},user:{orderIds:['demo_order_001','demo_order_002']},
    orders:{demo_order_001:existing},nextOrderNumber:1,cart:{shopId:'rice',quantities:{chicken:1}}}));
  it('skips both existing records and reserved history references without overwriting',()=>{
    const id=useMeituanStore.getState().createOrder(shop.id,shop.name,[item]);
    const state=useMeituanStore.getState();
    expect(id).toBe('demo_order_003');expect(state.orders.demo_order_001).toEqual(existing);
    expect(state.user.orderIds).toEqual(['demo_order_003','demo_order_001','demo_order_002']);
    expect(state.nextOrderNumber).toBe(4);expect(state.cart.quantities).toEqual({});
  });
  it('preserves history if collisions exhaust the remaining safe counter range',()=>{
    const reserved=`demo_order_${Number.MAX_SAFE_INTEGER-1}`;
    useMeituanStore.setState({nextOrderNumber:Number.MAX_SAFE_INTEGER-1,user:{orderIds:[reserved]}});
    expect(useMeituanStore.getState().createOrder(shop.id,shop.name,[item])).toBeNull();
    expect(useMeituanStore.getState().user.orderIds).toEqual([reserved]);
    expect(useMeituanStore.getState().cart.quantities).toEqual({chicken:1});
  });
  it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])('refuses invalid or exhausted counter %s without changing the cart or history',counter=>{
    useMeituanStore.setState({nextOrderNumber:counter});
    expect(useMeituanStore.getState().createOrder(shop.id,shop.name,[item])).toBeNull();
    const state=useMeituanStore.getState();expect(state.orders).toEqual({demo_order_001:existing});
    expect(state.user.orderIds).toEqual(['demo_order_001','demo_order_002']);expect(state.cart.quantities).toEqual({chicken:1});
    expect(Object.is(state.nextOrderNumber,counter)).toBe(true);
  });
});
