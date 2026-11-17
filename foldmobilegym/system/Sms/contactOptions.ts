import type { Contact } from '../Contacts/types';

export interface SmsContactOption {
  key: string;
  contactId: string;
  displayName: string;
  phoneNumber: string;
  avatarColor?: string;
}

export function smsContactOptions(contacts: readonly Contact[]): SmsContactOption[] {
  return contacts.flatMap(contact => {
    const displayName = contact.displayName.trim();
    if (!displayName) return [];
    const seen = new Set<string>();
    return (contact.phones ?? []).flatMap((phone, index) => {
      const phoneNumber = phone.number.replace(/\s/g, '');
      if (!phoneNumber || seen.has(phoneNumber)) return [];
      seen.add(phoneNumber);
      return [{ key: JSON.stringify([contact.id, phone.id, index]), contactId: contact.id,
        displayName, phoneNumber, avatarColor: contact.avatarColor }];
    });
  });
}

export function filterSmsContactOptions(options: readonly SmsContactOption[], query: string) {
  const q = query.trim().toLowerCase(), digits = q.replace(/\D/g, '');
  return !q ? options : options.filter(option => option.displayName.toLowerCase().includes(q)
    || (digits.length > 0 && option.phoneNumber.replace(/\D/g, '').includes(digits)));
}
