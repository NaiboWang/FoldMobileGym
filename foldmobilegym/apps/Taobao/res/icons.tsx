import React from 'react';
import type { IconProps } from '@/os/types/res';
import { ArrowLeft, Bell, BellRing, Bot, Camera, ChevronRight, CircleDollarSign, ContactRound, Crown, Gamepad2, Heart, Home, Image, Megaphone, MessageCircle, PackageCheck, Percent, Plus, Search, ShoppingBag, ShoppingCart, TicketPercent, Undo2, User, X } from 'lucide-react';

export const IcBack = ArrowLeft;
export const IcCamera = Camera;
export const IcChevron = ChevronRight;
export const IcHeart = Heart;
export const IcHome = Home;
export const IcImage = Image;
export const IcMessage = MessageCircle;
export const IcSearch = Search;
export const IcBag = ShoppingBag;
export const IcCart = ShoppingCart;
export const IcUser = User;
export const IcMessageLogistics = PackageCheck;
export const IcMessageAfterSale = Undo2;
export const IcMessagePromotion = Percent;
export const IcMessageAssistant = Bot;
export const IcMessageCoins = CircleDollarSign;
export const IcMessageOffers = TicketPercent;
export const IcMessageVip = Crown;
export const IcMessageInteractive = Gamepad2;
export const IcMessageService = Bell;
export const IcMessageSystem = Megaphone;
export const IcMessageNotification = BellRing;
export const IcMessageContacts = ContactRound;
export const IcPlus = Plus;
export const IcClose = X;

export const IcLauncher: React.FC<{ size?: number; className?: string }> = ({ size = 48, className }) => (
  <div className={className} style={{ width: size, height: size, borderRadius: Math.round(size * .24), display: 'grid', placeItems: 'center', color: '#fff', background: 'linear-gradient(145deg, #ff7a00, #ff3d00)', fontSize: Math.round(size * .52), fontWeight: 900, fontFamily: 'sans-serif' }}>
    淘
  </div>
);

export const IcLauncherGlyph: React.FC<IconProps> = ({ size = 32, className, color = '#fff' }) => {
  const pixelSize = typeof size === 'number' ? size : Number.parseFloat(size) || 32;
  return (
    <span className={className} style={{ width: size, height: size, display: 'grid', placeItems: 'center', color, fontSize: Math.round(pixelSize * .86), lineHeight: 1, fontWeight: 900, fontFamily: 'sans-serif' }}>
      淘
    </span>
  );
};

type TabIconProps = { active: boolean; size?: number };
const tabColor = '#ff5a1f';
export const IcTaobaoTabHome: React.FC<TabIconProps> = ({ active, size = 28 }) => active ? <span className="tb-tab-tao" style={{ width: size, height: size }}>淘</span> : <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M4.5 12.1 14 4.8l9.5 7.3v10.2a1.7 1.7 0 0 1-1.7 1.7H6.2a1.7 1.7 0 0 1-1.7-1.7V12.1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M10.5 24v-7.2h7V24" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;
export const IcTaobaoTabVideo: React.FC<TabIconProps> = ({ active, size = 28 }) => <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="4" y="5" width="20" height="18" rx="4" fill={active ? tabColor : 'none'} stroke={active ? tabColor : 'currentColor'} strokeWidth="2"/><path d="m12 10 7 4-7 4v-8Z" fill={active ? '#fff' : 'currentColor'}/></svg>;
export const IcTaobaoTabMessage: React.FC<TabIconProps> = ({ active, size = 28 }) => <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M4 13.5C4 8.25 8.35 4 14 4s10 4.25 10 9.5S19.65 23 14 23c-1.25 0-2.45-.21-3.55-.59L6 24l1.14-3.68A9.12 9.12 0 0 1 4 13.5Z" fill={active ? tabColor : 'none'} stroke={active ? tabColor : 'currentColor'} strokeWidth="2" strokeLinejoin="round"/>{[10,14,18].map(cx => <circle key={cx} cx={cx} cy="13.5" r="1.25" fill={active ? '#fff' : 'currentColor'}/>)}</svg>;
export const IcTaobaoTabCart: React.FC<TabIconProps> = ({ active, size = 28 }) => <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M3.5 5h3l2.2 12.1a2 2 0 0 0 2 1.65h9.85a2 2 0 0 0 1.94-1.52L24.5 9H7.2" fill={active ? tabColor : 'none'} stroke={active ? tabColor : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{active && <path d="M11 12.5h9M12 15.5h7" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>}<circle cx="11" cy="23" r="1.7" fill={active ? tabColor : 'currentColor'}/><circle cx="21" cy="23" r="1.7" fill={active ? tabColor : 'currentColor'}/></svg>;
export const IcTaobaoTabMe: React.FC<TabIconProps> = ({ active, size = 28 }) => <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="10" fill={active ? tabColor : 'none'} stroke={active ? tabColor : 'currentColor'} strokeWidth="2"/><circle cx="14" cy="11" r="3" fill={active ? '#fff' : 'none'} stroke={active ? '#fff' : 'currentColor'} strokeWidth="1.7"/><path d="M8.7 20c1.2-2.9 3-4.3 5.3-4.3s4.1 1.4 5.3 4.3" stroke={active ? '#fff' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round"/></svg>;
