import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import type { TransitionId } from './navigation.declaration';
import { normalizeTaobaoOrderStatus } from './orderModel';
import { getTracker } from '../../os/utils/memoryHistoryTracker';
import { hasTaobaoCartSkuParent, taobaoCartSkuParent } from './cartSkuModel';

export function shouldReplaceTaobaoTransition(id: TransitionId): boolean {
  return id.startsWith('taobao.tab.') || id === 'taobao.orders.status.switch' || id === 'taobao.search.sort.switch';
}

export function useAppNavigate() {
  const navigate = useNavigate();
  const go = useCallback((id: TransitionId, params: Record<string, string | number> = {}) => {
    const orderStatus = normalizeTaobaoOrderStatus(typeof params.status === 'string' ? params.status : null);
    const orderTarget = orderStatus === 'all' ? '/orders' : `/orders?status=${orderStatus}`;
    const searchTarget = params.sort === 'sales' ? '/search?sort=sales' : '/search';
    const targets: Record<TransitionId, string> = {
      'taobao.home.search.open': '/search',
      'taobao.search.sort.switch': searchTarget,
      'taobao.search.cart.open': '/cart',
      'taobao.product.open': `/item/${params.id}`,
      'taobao.item.sku.open': `/item/${params.id}?sheet=sku`,
      'taobao.item.cart.open': '/cart',
      'taobao.cart.manage.open': '/cart?manage=1',
      'taobao.cart.sku.open': `/cart?sheet=sku&productId=${encodeURIComponent(params.productId ?? '')}`,
      'taobao.cart.manage.sku.open': `/cart?manage=1&sheet=sku&productId=${encodeURIComponent(params.productId ?? '')}`,
      'taobao.cart.remove.confirm.open': '/cart?manage=1&dialog=remove',
      'taobao.orders.open': orderTarget,
      'taobao.orders.status.switch': orderTarget,
      'taobao.tab.home': '/',
      'taobao.tab.discover': '/discover',
      'taobao.tab.messages': '/messages',
      'taobao.tab.cart': '/cart',
      'taobao.tab.me': '/me',
    };
    navigate(targets[id], { replace: shouldReplaceTaobaoTransition(id) });
  }, [navigate]);
  const back = useCallback(() => navigate(-1), [navigate]);
  return { go, back };
}

export function useCloseTaobaoCartSku() {
  const navigate = useNavigate(), location = useLocation(), { navigator } = useContext(UNSAFE_NavigationContext);
  return useCallback(() => {
    const query = new URLSearchParams(location.search);
    if (location.pathname !== '/cart' || query.get('sheet') !== 'sku') return;
    const tracker = getTracker(navigator as object), previous = tracker?.stack[(tracker?.index ?? 0) - 1];
    if (hasTaobaoCartSkuParent(location.search, previous)) navigate(-1);
    else navigate(taobaoCartSkuParent(location.search), { replace: true });
  }, [location.pathname, location.search, navigate, navigator]);
}
