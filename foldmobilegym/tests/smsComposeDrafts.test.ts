import { describe, expect, it } from 'vitest';
import { patchSmsComposeDraft, smsComposeDraftKey, type SmsComposeDraft } from '../system/Sms/composeDrafts';
import { primaryContactPhone } from '../system/Contacts/utils/contactPhone';

const seed: SmsComposeDraft = { recipient: '12306', body: '', boundPhone: null };
describe('SMS compose draft isolation', () => {
  it('reuses a requested address despite display whitespace', () => {
    expect(smsComposeDraftKey(' 123 06 ', '')).toBe(smsComposeDraftKey('12306', ''));
  });
  it('does not collapse country codes or different addresses', () => {
    expect(smsComposeDraftKey('+8613800000000', '')).not.toBe(smsComposeDraftKey('13800000000', ''));
    expect(smsComposeDraftKey('10086', '')).not.toBe(smsComposeDraftKey('12306', ''));
  });
  it('isolates explicitly prefilled requests from ordinary unfinished text', () => {
    expect(smsComposeDraftKey('12306', '999')).not.toBe(smsComposeDraftKey('12306', ''));
    expect(smsComposeDraftKey('12306', '999 ')).not.toBe(smsComposeDraftKey('12306', '999'));
  });
  it('supports old persisted states without a composeDrafts field', () => {
    expect(patchSmsComposeDraft(undefined, 'a', seed, { body: 'Draft' }).a).toEqual({ ...seed, body: 'Draft' });
  });
  it('merges successive fields without clobbering the preceding edit', () => {
    const first = patchSmsComposeDraft({}, 'a', seed, { body: 'Keep me' });
    expect(patchSmsComposeDraft(first, 'a', seed, { recipient: 'Alice', boundPhone: '10086' }).a)
      .toEqual({ body: 'Keep me', recipient: 'Alice', boundPhone: '10086' });
  });
  it('keeps another recipient and seed immutable', () => {
    const first = { other: { ...seed, body: 'Unchanged' } };
    const next = patchSmsComposeDraft(first, 'a', seed, { body: 'New' });
    expect(next.other).toBe(first.other); expect(first).not.toHaveProperty('a'); expect(seed.body).toBe('');
  });
  it('can unbind a selected contact without losing text', () => {
    const first = patchSmsComposeDraft({}, 'a', seed, { recipient: 'Alice', boundPhone: '10086', body: 'Text' });
    expect(patchSmsComposeDraft(first, 'a', seed, { recipient: '12306', boundPhone: null }).a)
      .toEqual({ recipient: '12306', boundPhone: null, body: 'Text' });
  });
  it('an explicitly cleared sent body cannot revive the original incoming text', () => {
    const incoming = { ...seed, body: '999' };
    const drafts = patchSmsComposeDraft({}, 'incoming', incoming, { body: '' });
    expect(patchSmsComposeDraft(drafts, 'incoming', incoming, {}).incoming.body).toBe('');
  });
});
describe('Contact primary phone selection', () => {
  it('prefers the declared usable primary without changing its formatting', () => {
    expect(primaryContactPhone([{ id: '1', label: '', number: '10086' }, { id: '2', label: '', number: '+86 138 0000 0000', isPrimary: true }])).toBe('+86 138 0000 0000');
  });
  it('falls back from an empty primary to the first usable number', () => {
    expect(primaryContactPhone([{ id: '1', label: '', number: ' ', isPrimary: true }, { id: '2', label: '', number: '12306' }])).toBe('12306');
  });
  it('does not invent a recipient for a contact without a number', () => {
    expect(primaryContactPhone([])).toBe('');
  });
});
