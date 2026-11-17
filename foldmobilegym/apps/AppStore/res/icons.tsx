import React from 'react';
export { ArrowLeft as IcBack, Search as IcSearch, Sparkles as IcToday, LayoutGrid as IcApps } from 'lucide-react';
export function IcLauncher({ size = 24, color = 'currentColor' }: { size?: string | number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M12 6L25 27M20 6L7 27M5 21H27" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
  </svg>;
}
