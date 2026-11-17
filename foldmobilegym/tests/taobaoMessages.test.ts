import { describe, expect, it } from 'vitest';
import {
  dismissTaobaoMessageNotificationPrompt,
  dismissTaobaoMessagePromo,
  enableTaobaoMessageNotifications,
  markAllTaobaoMessagesRead,
  markTaobaoMessageRead,
  normalizeTaobaoMessageState,
  type TaobaoMessageState,
} from '../apps/Taobao/messageModel';

const defaults: TaobaoMessageState = {
  unreadThreadIds: ['coins', 'offers', 'vip'],
  dismissedPromoIds: [],
  notificationPromptDismissed: false,
  notificationsEnabled: false,
  scrollTop: 12,
};

describe('Taobao message state', () => {
  it('restores defaults for legacy persisted state and removes invalid IDs', () => {
    expect(normalizeTaobaoMessageState(undefined, defaults)).toEqual(defaults);
    expect(normalizeTaobaoMessageState({ unreadThreadIds: ['coins', 'unknown', 'coins'] as never[] }, defaults).unreadThreadIds).toEqual(['coins']);
  });

  it('marks one or all threads read without changing other message preferences', () => {
    const oneRead = markTaobaoMessageRead(defaults, 'offers');
    expect(oneRead.unreadThreadIds).toEqual(['coins', 'vip']);
    expect(oneRead.scrollTop).toBe(12);
    expect(markAllTaobaoMessagesRead(oneRead).unreadThreadIds).toEqual([]);
  });

  it('dismisses the promotion idempotently', () => {
    const dismissed = dismissTaobaoMessagePromo(defaults, 'promotion');
    expect(dismissed.dismissedPromoIds).toEqual(['promotion']);
    expect(dismissTaobaoMessagePromo(dismissed, 'promotion')).toBe(dismissed);
  });

  it('separates enabling reminders from merely dismissing the prompt', () => {
    expect(enableTaobaoMessageNotifications(defaults)).toMatchObject({ notificationsEnabled: true, notificationPromptDismissed: true });
    expect(dismissTaobaoMessageNotificationPrompt(defaults)).toMatchObject({ notificationsEnabled: false, notificationPromptDismissed: true });
  });
});
