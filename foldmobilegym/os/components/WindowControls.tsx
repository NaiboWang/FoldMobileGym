import React, { useRef } from 'react';
import { useOsT } from '../i18n';
import { clampFloatingBounds, type FloatingBounds } from '../windowGestures';

export function FloatingWindowChrome({ bounds, onBounds, onMinimize, onMaximize, onClose, label }: {
  bounds: FloatingBounds; onBounds: (bounds: FloatingBounds) => void;
  onMinimize: () => void; onMaximize: () => void; onClose: () => void; label: string;
}) {
  const t = useOsT();
  const drag = useRef<{ id: number; x: number; y: number; width: number; height: number; initial: FloatingBounds; resize: boolean } | null>(null);
  const start = (event: React.PointerEvent<HTMLElement>, resize: boolean) => {
    if (!event.isPrimary || event.button !== 0) return;
    // The activity container is already scaled for the human preview.
    const device = event.currentTarget.closest('[data-app-id]')?.parentElement?.getBoundingClientRect();
    if (!device) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
      width: device.width, height: device.height, initial: bounds, resize };
  };
  const move = (event: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = (event.clientX - current.x) / current.width, dy = (event.clientY - current.y) / current.height;
    const initial = current.initial;
    onBounds(clampFloatingBounds(current.resize
      ? { ...initial, width: Math.min(1 - initial.x, initial.width + dx), height: Math.min(0.96 - initial.y, initial.height + dy) }
      : { ...initial, x: initial.x + dx, y: initial.y + dy }));
  };
  const end = () => { drag.current = null; };
  return <>
    <header className="os-floating-toolbar">
      <div className="os-floating-drag" aria-label={t('移动悬浮窗')} onPointerDown={e => start(e, false)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}><span />{label}</div>
      <button type="button" aria-label={t('收起悬浮窗')} onClick={onMinimize}>−</button>
      <button type="button" aria-label={t('恢复全屏')} onClick={onMaximize}>□</button>
      <button type="button" aria-label={t('关闭悬浮窗')} onClick={onClose}>×</button>
    </header>
    <div className="os-floating-resize" aria-label={t('调整悬浮窗大小')} onPointerDown={e => start(e, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
  </>;
}
