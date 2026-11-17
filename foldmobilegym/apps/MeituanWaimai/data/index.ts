import defaults from './defaults.json';
import baseShops from './shops.json';
import type { Shop, ShopOverlays } from '../types';

export const MEITUAN_CONFIG = defaults;

// World data remains off-snapshot. Scenario-injected full entities override it.
export function resolveMeituanShops(overlays: ShopOverlays = {}): Shop[] {
  const resolved = new Map<string, Shop>(baseShops.map(shop => [shop.id, shop as Shop]));
  for (const [id, shop] of Object.entries(overlays)) {
    if (shop === undefined) continue;
    if (shop === null) { resolved.delete(id); continue; }
    if (shop.id !== id) throw new Error(`Meituan shop overlay identity mismatch: ${id}`);
    resolved.set(id, shop);
  }
  return [...resolved.values()];
}
