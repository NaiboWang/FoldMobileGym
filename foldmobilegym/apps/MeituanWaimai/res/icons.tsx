import React from 'react';
import {
  Bike as IcDelivery, Tickets as IcDeals, Building2 as IcTravel,
  ShoppingBag as IcFlash, Cross as IcHealth, ShoppingBasket as IcGroceries,
  Utensils as IcDining, Gamepad2 as IcFun, Soup as IcPinhaofan,
  Clapperboard as IcMovies, Apple as IcFruit, Wrench as IcLocal,
  Footprints as IcMassage, Sprout as IcFreeFruit, LayoutGrid as IcMore,
  House as IcHome, CirclePlay as IcVideo, Sparkles as IcAssistant,
  ShoppingCart as IcCart, UserRound as IcUser, MessageCircle as IcMessage,
  ScanLine as IcScan, Store as IcStore, Plus as IcAdd, Minus as IcRemove,
} from 'lucide-react';

export { IcHome, IcVideo, IcAssistant, IcCart, IcUser, IcMessage, IcScan, IcStore, IcAdd, IcRemove };
export const ICON_REGISTRY = {
  IcDelivery, IcDeals, IcTravel, IcFlash, IcHealth, IcGroceries, IcDining,
  IcFun, IcPinhaofan, IcMovies, IcFruit, IcLocal, IcMassage, IcFreeFruit, IcMore,
};
export type ServiceIconName = keyof typeof ICON_REGISTRY;

/** Reference main-App mark, not the separate food-delivery shopping-bag icon. */
export const IcLauncher: React.FC<{ className?: string; size?: string | number }> = ({ className, size = 26 }) => {
  const pixels = typeof size === 'number' ? size : Number.parseFloat(size) || 26;
  return <svg className={className} width={Math.round(pixels / 0.55)} height={Math.round(pixels / 0.55)} viewBox="0 0 48 48" aria-hidden="true" data-meituan-main-icon="true">
    <rect x="2" y="2" width="44" height="44" rx="10" fill="#ffdf00" />
    <text x="24" y="31" textAnchor="middle" fontSize="19" fontWeight="900" fontFamily="'Microsoft YaHei','PingFang SC',sans-serif" fill="#171717">美团</text>
  </svg>;
};
