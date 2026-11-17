import { describe, expect, it } from 'vitest';
import { compareRecoveredForm, hasCartEntryProgress, hasDraftEntryProgress, hasTargetCommitProgress, isExpectedShopRoute, targetAppIds } from '../foldagent_progress';

describe('FoldAgent semantic progress', () => {
  it('requires the expected existing store detail route, not home or a different store', () => {
    for (const route of ['/', '/cart', '/shop/tea', '/shop/rice-other', '/shop/rice/unknown', '/shop/%ZZ']) {
      expect(isExpectedShopRoute(route, ['rice'], ['rice', 'tea'])).toBe(false);
    }
    for (const route of ['/shop/rice', '/shop/rice/reviews', '/shop/rice/info', '/shop/rice?q=test']) {
      expect(isExpectedShopRoute(route, ['rice'], ['rice', 'tea'])).toBe(true);
    }
    expect(isExpectedShopRoute('/shop/missing', ['missing'], ['rice'])).toBe(false);
    expect(isExpectedShopRoute('/shop/rice', [], ['rice'])).toBe(false);
  });
  it('detects cart entry without mistaking shop selection or initial items for progress', () => {
    const initial = { cart: { shopId: 'rice', quantities: { chicken: 1 } } };
    expect(hasCartEntryProgress(initial, initial)).toBe(false);
    expect(hasCartEntryProgress({ cart: { shopId: 'tea', quantities: {} } }, initial)).toBe(false);
    expect(hasCartEntryProgress({ cart: { shopId: 'rice', quantities: { chicken: 2 } } }, initial)).toBe(true);
    expect(hasCartEntryProgress({ cart: { shopId: 'tea', quantities: { chicken: 1 } } }, initial)).toBe(true);
    expect(hasCartEntryProgress({ cart: { shopId: 'rice', quantities: {} } }, initial)).toBe(false);
  });
  it('ignores invalid quantities and includes single-app targets', () => {
    for (const quantity of [NaN, Infinity, 0, -1, 0.5]) {
      expect(hasCartEntryProgress({ cart: { shopId: 'rice', quantities: { chicken: quantity } } })).toBe(false);
    }
    expect(targetAppIds(['meituan_waimai'])).toEqual(['meituan_waimai']);
    expect(targetAppIds(['mail', 'calendar'])).toEqual(['calendar']);
    expect(targetAppIds(['map', 'calendar', 'wechat'], 'calendar')).toEqual(['calendar']);
  });
  it('allows additional controls revealed by an expanded layout', () => {
    const before = [{ key: 'title', value: 'Partial draft' }];
    const after = [...before, { key: 'end-time', value: '01:30' }];
    expect(compareRecoveredForm(before, after)).toEqual({ fieldsPreserved: true, valuesPreserved: true });
    expect(compareRecoveredForm(before, [...after].reverse()).valuesPreserved).toBe(true);
  });
  it('rejects missing fields, changed values, and ambiguous duplicate keys', () => {
    const before = [{ key: 'title', value: 'Partial draft' }];
    expect(compareRecoveredForm(before, []).fieldsPreserved).toBe(false);
    expect(compareRecoveredForm(before, [{ key: 'title', value: 'Wrong' }]).valuesPreserved).toBe(false);
    expect(compareRecoveredForm(before, [...before, ...before]).fieldsPreserved).toBe(false);
    expect(compareRecoveredForm([...before, ...before], before).fieldsPreserved).toBe(false);
  });
  it('does not treat default dates, IDs, toggles or reminder options as entry', () => {
    expect(hasDraftEntryProgress({ draft: { title: '', notes: '', location: '',
      eventId: 'source-event', eventType: 'event', startTs: 100, endTs: 200,
      startTimeInput: '00:30', endTimeInput: '01:30', allDay: false,
      alarmEnabled: true, reminderMinutesBefore: 15 } })).toBe(false);
  });
  it('requires a change to nonempty authored text', () => {
    const initial = { draft: { title: 'Existing' }, drafts: { partner: { text: 'Existing draft' } } };
    expect(hasDraftEntryProgress(initial, initial)).toBe(false);
    expect(hasDraftEntryProgress({ draft: { title: 'New' } }, initial)).toBe(true);
    expect(hasDraftEntryProgress({ drafts: { partner: { text: 'New draft' } } }, initial)).toBe(true);
    expect(hasDraftEntryProgress({ draft: { notes: '   ' } })).toBe(false);
  });
  it('excludes source counters and initial target objects from first-target progress', () => {
    const initial = { mail: { created_count: 5 }, calendar: { created_count: 2 } };
    expect(hasTargetCommitProgress(initial, initial, ['calendar'])).toBe(false);
    expect(hasTargetCommitProgress({ ...initial, mail: { created_count: 6 } }, initial, ['calendar'])).toBe(false);
    expect(hasTargetCommitProgress({ ...initial, calendar: { created_count: 3 } }, initial, ['calendar'])).toBe(true);
  });
});
