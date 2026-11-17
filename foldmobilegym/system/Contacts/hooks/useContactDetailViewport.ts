import { useContext, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import type { Contact } from '../types';

export class ContactDetailViewportCache {
  private entries = new Map<string, { source: object; top: number }>();
  constructor(private limit = 24) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Viewport cache limit must be a positive integer');
  }

  remember(key: string, source: object, top: number): void {
    if (!key || !Number.isFinite(top) || top < 0) return;
    this.entries.delete(key);
    this.entries.set(key, { source, top });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
  }

  read(key: string, source: object): number | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.source !== source) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.top;
  }
}

// Each Activity owns a MemoryRouter. A destroyed router releases its bounded UI cache.
const caches = new WeakMap<object, ContactDetailViewportCache>();
export function useContactDetailViewport(contact: Contact | undefined) {
  const { navigator } = useContext(UNSAFE_NavigationContext), { key } = useLocation();
  let cache = caches.get(navigator as object);
  if (!cache) { cache = new ContactDetailViewportCache(); caches.set(navigator as object, cache); }
  const scrollRef = useRef<HTMLDivElement | null>(null), previousId = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !contact) return;
    const saved = cache.read(key, contact);
    if (saved !== undefined) element.scrollTop = saved;
    else if (previousId.current !== contact.id) element.scrollTop = 0;
    previousId.current = contact.id;
    const remember = () => cache.remember(key, contact, element.scrollTop);
    element.addEventListener('scroll', remember, { passive: true });
    return () => { remember(); element.removeEventListener('scroll', remember); };
  }, [cache, contact, key]);
  return scrollRef;
}
