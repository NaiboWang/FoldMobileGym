import type { Contact, ContactEmail } from '../types';
import { normalizeEmailAddress } from '@/os/utils/emailAddress';
import type { IntentPayload } from '@/os/types/manifest';

/** The caller additionally checks foreground Activity and exact current contact. */
export function contactEmailIntent(contact: Contact, email: ContactEmail, expectedId: string, expectedAddress: string): IntentPayload | null {
  const sources = contact.emails?.filter(item => item.id === expectedId) ?? [];
  if (sources.length !== 1 || sources[0] !== email || email.email !== expectedAddress) return null;
  const address = normalizeEmailAddress(expectedAddress);
  return address ? { action: 'ACTION_VIEW', scheme: 'mailto', data: { address } } : null;
}
