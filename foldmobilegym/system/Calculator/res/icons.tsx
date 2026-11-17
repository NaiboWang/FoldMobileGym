// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import { Calculator, History, X, Check, Pencil, Trash2 } from 'lucide-react';

// ── App launcher ──────────────────────────────────────────
export const IcCalculator = Calculator;
export const IcLauncher = Calculator;
export const IcHistory = History;
export const IcClose = X;
export const IcCheck = Check;
export const IcEdit = Pencil;
export const IcTrash = Trash2;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcCalculator,
  IcLauncher,
  IcHistory,
  IcClose,
  IcCheck,
  IcEdit,
  IcTrash,
};
