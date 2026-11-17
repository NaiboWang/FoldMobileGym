import type { IntentPayload } from '@/os/types/manifest';

/** Resolve only a dial entry; unrelated routes and explicit number seeds win. */
export function dialIntentRoute(route: string, intent: IntentPayload | null | undefined): string {
  const [pathname, query = ''] = route.split('?');
  const params = new URLSearchParams(query);
  if (pathname !== '/' || params.get('dialpad') !== 'true' || params.has('number')) return route;
  if (intent?.action !== 'ACTION_DIAL' && !(intent?.action === 'ACTION_VIEW' && intent.scheme === 'tel')) return route;
  const number = typeof intent.data?.number === 'string' ? intent.data.number
    : typeof intent.data?.address === 'string' ? intent.data.address : '';
  if (!number.trim()) return route;
  params.set('number', number.replace(/\s/g, ''));
  return `${pathname}?${params}`;
}
