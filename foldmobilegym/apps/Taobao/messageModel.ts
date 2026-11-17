import { TAOBAO_MESSAGE_CHANNELS, type TaobaoMessageThreadId } from './constants';

export interface TaobaoMessageState {
  unreadThreadIds: TaobaoMessageThreadId[];
  dismissedPromoIds: TaobaoMessageThreadId[];
  notificationPromptDismissed: boolean;
  notificationsEnabled: boolean;
  scrollTop: number;
}

const validThreadIds = new Set<string>(TAOBAO_MESSAGE_CHANNELS.map(channel => channel.id));

function normalizeThreadIds(value: unknown): TaobaoMessageThreadId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is TaobaoMessageThreadId => typeof id === 'string' && validThreadIds.has(id)))];
}

function finiteScrollTop(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function normalizeTaobaoMessageState(
  value: Partial<TaobaoMessageState> | null | undefined,
  fallback?: Partial<TaobaoMessageState> | null,
): TaobaoMessageState {
  const source = value ?? fallback ?? {};
  const fallbackUnread = normalizeThreadIds(fallback?.unreadThreadIds);
  const fallbackDismissed = normalizeThreadIds(fallback?.dismissedPromoIds);
  return {
    unreadThreadIds: Array.isArray(source.unreadThreadIds) ? normalizeThreadIds(source.unreadThreadIds) : fallbackUnread,
    dismissedPromoIds: Array.isArray(source.dismissedPromoIds) ? normalizeThreadIds(source.dismissedPromoIds) : fallbackDismissed,
    notificationPromptDismissed: typeof source.notificationPromptDismissed === 'boolean'
      ? source.notificationPromptDismissed
      : Boolean(fallback?.notificationPromptDismissed),
    notificationsEnabled: typeof source.notificationsEnabled === 'boolean'
      ? source.notificationsEnabled
      : Boolean(fallback?.notificationsEnabled),
    scrollTop: typeof source.scrollTop === 'number' ? finiteScrollTop(source.scrollTop) : finiteScrollTop(fallback?.scrollTop),
  };
}

export function markTaobaoMessageRead(state: TaobaoMessageState, threadId: TaobaoMessageThreadId): TaobaoMessageState {
  return { ...state, unreadThreadIds: state.unreadThreadIds.filter(id => id !== threadId) };
}

export function markAllTaobaoMessagesRead(state: TaobaoMessageState): TaobaoMessageState {
  return state.unreadThreadIds.length ? { ...state, unreadThreadIds: [] } : state;
}

export function dismissTaobaoMessagePromo(state: TaobaoMessageState, threadId: TaobaoMessageThreadId): TaobaoMessageState {
  if (state.dismissedPromoIds.includes(threadId)) return state;
  return { ...state, dismissedPromoIds: [...state.dismissedPromoIds, threadId] };
}

export function enableTaobaoMessageNotifications(state: TaobaoMessageState): TaobaoMessageState {
  return { ...state, notificationsEnabled: true, notificationPromptDismissed: true };
}

export function dismissTaobaoMessageNotificationPrompt(state: TaobaoMessageState): TaobaoMessageState {
  return state.notificationPromptDismissed ? state : { ...state, notificationPromptDismissed: true };
}
