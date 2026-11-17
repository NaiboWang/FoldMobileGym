// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  ArrowLeft,
  Bookmark,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Globe,
  Home,
  Layers,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  Shield,
  X,
} from 'lucide-react';
import type { SVGProps } from 'react';

// ── Navigation ────────────────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcBack = ArrowLeft;
export const IcForward = ArrowRight;
export const IcClose = X;
export const IcHome = Home;

// ── Common actions ────────────────────────────────────────
export const IcSearch = Search;
export const IcBookmark = Bookmark;
export const IcAdd = Plus;
export const IcMore = MoreHorizontal;
export const IcMoreHoriz = MoreHorizontal;
export const IcRefresh = RotateCw;

// ── Browser specific ──────────────────────────────────────
export const IcGlobe = Globe;
export const IcShield = Shield;
export const IcTabs = Layers;

// ── App launcher ──────────────────────────────────────────
// Chrome's three-colour pinwheel with the blue centre, kept as a local SVG so
// the controlled benchmark never depends on a remote image asset.
export const IcLauncher = ({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" {...props}>
    <path fill="#ea4335" d="M24 3a21 21 0 0 1 18.19 31.5L24 24Z" />
    <path fill="#fbbc04" d="M42.19 34.5A21 21 0 0 1 5.81 34.5L24 24Z" />
    <path fill="#34a853" d="M5.81 34.5A21 21 0 0 1 24 3v21Z" />
    <circle cx="24" cy="24" r="9.5" fill="#fff" />
    <circle cx="24" cy="24" r="7.5" fill="#4285f4" />
  </svg>
);

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcBack,
  IcForward,
  IcClose,
  IcHome,
  IcSearch,
  IcAdd,
  IcMore,
  IcMoreHoriz,
  IcRefresh,
  IcGlobe,
  IcShield,
  IcTabs,
  IcLauncher,
};
