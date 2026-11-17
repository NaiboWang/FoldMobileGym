import type { Contact } from '../types';

export function primaryContactPhone(phones: Contact['phones']): string {
  const available = (phones ?? []).filter(phone => phone.number.trim());
  return (available.find(phone => phone.isPrimary) ?? available[0])?.number ?? '';
}
