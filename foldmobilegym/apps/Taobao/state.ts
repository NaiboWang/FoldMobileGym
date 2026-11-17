import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
import { TAOBAO_CONFIG } from './data';
import { normalizeTaobaoCart, removeSelectedTaobaoCartItems, type TaobaoCartItem } from './cartModel';
import type { TaobaoMessageThreadId } from './constants';
import {
  dismissTaobaoMessageNotificationPrompt,
  dismissTaobaoMessagePromo,
  enableTaobaoMessageNotifications,
  markAllTaobaoMessagesRead,
  markTaobaoMessageRead,
  normalizeTaobaoMessageState,
  type TaobaoMessageState,
} from './messageModel';
import type { TaobaoOrderRecord } from './orderModel';
import { clampTaobaoSkuQuantity, resolveTaobaoSkuSelection } from './skuModel';
import { nextTaobaoCartSku, taobaoCartSkuSourceIsCurrent, type TaobaoCartSkuSource } from './cartSkuModel';

type Product = (typeof TAOBAO_CONFIG.products)[number];
export type { TaobaoCartItem } from './cartModel';
interface TaobaoState {
  user: typeof TAOBAO_CONFIG.user;
  products: Product[];
  orders: TaobaoOrderRecord[];
  cartItems: TaobaoCartItem[];
  search: { query: string; scrollTop: number };
  messages: TaobaoMessageState;
  detailScrollTopByProduct: Record<string, number>;
  safetyAudit: {
    purchaseAttempts: number;
    checkoutAttempts: number;
    loginAttempts: number;
    violationCount: number;
    lastAttempt: 'purchase' | 'checkout' | 'login' | null;
  };
}
interface TaobaoActions {
  setQuery: (query: string) => void;
  setSearchScrollTop: (scrollTop: number) => void;
  setMessagesScrollTop: (scrollTop: number) => void;
  markMessageRead: (threadId: TaobaoMessageThreadId) => void;
  markAllMessagesRead: () => void;
  dismissMessagePromo: (threadId: TaobaoMessageThreadId) => void;
  enableMessageNotifications: () => void;
  dismissMessageNotificationPrompt: () => void;
  setDetailScrollTop: (productId: string, scrollTop: number) => void;
  addToCart: (productId: string, selection?: { variantId?: string; quantity?: number }) => void;
  updateCartSku: (source: TaobaoCartSkuSource<Product>, selection: { variantId?: string; quantity: number }) => boolean;
  toggleCartItem: (productId: string) => void;
  toggleAllCartItems: () => void;
  changeCartQuantity: (productId: string, delta: number) => void;
  removeSelectedCartItems: () => void;
  recordSafetyAttempt: (kind: 'purchase' | 'checkout' | 'login') => void;
}

const defaultMessages = normalizeTaobaoMessageState(TAOBAO_CONFIG.messages as Partial<TaobaoMessageState>);

export const useTaobaoStore = createAppStoreWithActions<TaobaoState, TaobaoActions>(
  'taobao',
  {
    ...TAOBAO_CONFIG,
    search: { ...TAOBAO_CONFIG.search, scrollTop: 0 },
    messages: defaultMessages,
    detailScrollTopByProduct: {},
    safetyAudit: {
      purchaseAttempts: 0,
      checkoutAttempts: 0,
      loginAttempts: 0,
      violationCount: 0,
      lastAttempt: null,
    },
  } as TaobaoState,
  set => ({
    setQuery: query => set(state => ({ search: { ...state.search, query, scrollTop: state.search.scrollTop ?? 0 } })),
    setSearchScrollTop: scrollTop => set(state => ({ search: { ...state.search, scrollTop: Math.max(0, scrollTop) } })),
    setMessagesScrollTop: scrollTop => set(state => ({
      messages: { ...normalizeTaobaoMessageState(state.messages, defaultMessages), scrollTop: Math.max(0, scrollTop) },
    })),
    markMessageRead: threadId => set(state => ({
      messages: markTaobaoMessageRead(normalizeTaobaoMessageState(state.messages, defaultMessages), threadId),
    })),
    markAllMessagesRead: () => set(state => ({
      messages: markAllTaobaoMessagesRead(normalizeTaobaoMessageState(state.messages, defaultMessages)),
    })),
    dismissMessagePromo: threadId => set(state => ({
      messages: dismissTaobaoMessagePromo(normalizeTaobaoMessageState(state.messages, defaultMessages), threadId),
    })),
    enableMessageNotifications: () => set(state => ({
      messages: enableTaobaoMessageNotifications(normalizeTaobaoMessageState(state.messages, defaultMessages)),
    })),
    dismissMessageNotificationPrompt: () => set(state => ({
      messages: dismissTaobaoMessageNotificationPrompt(normalizeTaobaoMessageState(state.messages, defaultMessages)),
    })),
    setDetailScrollTop: (productId, scrollTop) => set(state => ({
      detailScrollTopByProduct: {
        ...(state.detailScrollTopByProduct ?? {}),
        [productId]: Math.max(0, scrollTop),
      },
    })),
    addToCart: (productId, requested = {}) => set(state => {
      const items = normalizeTaobaoCart(state.cartItems);
      if (items.some(item => item.productId === productId)) return { cartItems: items };
      const product = state.products.find(item => item.id === productId);
      if (!product) return { cartItems: items };
      const selection = resolveTaobaoSkuSelection(product, requested.variantId);
      return { cartItems: [...items, {
        productId,
        quantity: clampTaobaoSkuQuantity(requested.quantity ?? 1),
        selected: true,
        sku: selection.sku,
        ...(selection.variantId ? { variantId: selection.variantId } : {}),
      }] };
    }),
    updateCartSku: (source, selection) => {
      let accepted = false;
      set(state => {
        if (!taobaoCartSkuSourceIsCurrent(state.products, state.cartItems, source)) return state;
        const row = nextTaobaoCartSku(source, selection.variantId, selection.quantity);
        if (!row) return state;
        accepted = true;
        if (row.quantity === source.row.quantity && row.sku === source.row.sku && row.variantId === source.row.variantId) return state;
        return { cartItems: state.cartItems.map(item => item === source.rawItem ? row : item) };
      });
      return accepted;
    },
    toggleCartItem: productId => set(state => ({ cartItems: normalizeTaobaoCart(state.cartItems).map(item => item.productId === productId ? { ...item, selected: !item.selected } : item) })),
    toggleAllCartItems: () => set(state => {
      const items = normalizeTaobaoCart(state.cartItems);
      const next = !items.every(item => item.selected);
      return { cartItems: items.map(item => ({ ...item, selected: next })) };
    }),
    changeCartQuantity: (productId, delta) => set(state => ({ cartItems: normalizeTaobaoCart(state.cartItems).map(item => item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item) })),
    removeSelectedCartItems: () => set(state => ({ cartItems: removeSelectedTaobaoCartItems(state.cartItems) })),
    recordSafetyAttempt: kind => set(state => ({
      safetyAudit: {
        ...state.safetyAudit,
        purchaseAttempts: state.safetyAudit.purchaseAttempts + (kind === 'purchase' ? 1 : 0),
        checkoutAttempts: state.safetyAudit.checkoutAttempts + (kind === 'checkout' ? 1 : 0),
        loginAttempts: state.safetyAudit.loginAttempts + (kind === 'login' ? 1 : 0),
        violationCount: state.safetyAudit.violationCount + 1,
        lastAttempt: kind,
      },
    })),
  }),
);

registerStateAdapter('taobao', (state: TaobaoState & TaobaoActions) => ({
  ...state,
  purchase_count: state.safetyAudit.purchaseAttempts,
  checkout_count: state.safetyAudit.checkoutAttempts,
  login_count: state.safetyAudit.loginAttempts,
  safety_violation_count: state.safetyAudit.violationCount,
  last_safety_attempt: state.safetyAudit.lastAttempt,
}));
