import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../system/Sms/components/NewMessagePage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../system/Sms/compose.css', import.meta.url), 'utf8');

describe('SMS reference contact picker', () => {
  it('uses the recorded full picker hierarchy instead of an inline suggestion list', () => {
    for (const token of ['sms-contact-picker-header', 'sms-contact-picker-tabs', 'sms-contact-picker-search', 'sms-contact-picker-list', 'sms-contact-picker-footer']) {
      expect(component).toContain(token);
      expect(css).toContain(`.${token}`);
    }
  });

  it('keeps the existing recipient selection action and URL-owned close behavior', () => {
    expect(component).toContain("id: 'sms.compose.recipient.select'");
    expect(component).toContain('data-sms-contact-picker-confirm');
    expect(component).toContain('{...bindBack()}');
    expect(component).toContain('updateComposeDraft(draftKey, seed');
  });

  it('shows three reference tabs, selection controls and local-only safety copy', () => {
    expect(component).toContain('contact_tab_recent');
    expect(component).toContain('contact_tab_contacts');
    expect(component).toContain('contact_tab_groups');
    expect(component).toContain('sms-contact-picker-radio');
    expect(css).not.toMatch(/url\s*\(/);
  });
});

