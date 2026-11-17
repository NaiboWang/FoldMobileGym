import { afterEach, describe, expect, it } from 'vitest';
import { useEbayStore } from '../apps/Ebay/state';

afterEach(() => {
  useEbayStore.setState({ cartItems: [], savedItems: [] });
});

describe('eBay local shopping state', () => {
  it('adds one cart entry per item and removes only the selected item', () => {
    const store = useEbayStore.getState();
    store.addCartItem('1');
    store.addCartItem('1');
    store.addCartItem('2');
    expect(useEbayStore.getState().cartItems).toEqual(['1', '2']);
    store.removeCartItem('1');
    expect(useEbayStore.getState().cartItems).toEqual(['2']);
  });

  it('toggles watchlist membership without duplicating it', () => {
    const store = useEbayStore.getState();
    store.toggleSavedItem('1');
    expect(useEbayStore.getState().savedItems).toEqual(['1']);
    store.toggleSavedItem('1');
    expect(useEbayStore.getState().savedItems).toEqual([]);
  });
});
