import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { sheetDragOffset } from '../utils';

/** Convert viewport pointers to this sheet's CSS pixels (including OS zoom). */
export function useSheetDrag(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; y: number; scale: number; height: number; target: HTMLElement } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const release = () => {
    const active = gesture.current;
    gesture.current = null;
    if (active?.target.hasPointerCapture(active.id)) active.target.releasePointerCapture(active.id);
  };
  useEffect(() => () => { release(); }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    const sheet = sheetRef.current;
    if (!sheet || !sheet.offsetHeight) return;
    const scale = sheet.getBoundingClientRect().height / sheet.offsetHeight;
    gesture.current = { id: event.pointerId, y: event.clientY, scale, height: sheet.offsetHeight, target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setDragOffset(0);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    setDragOffset(sheetDragOffset(event.clientY - active.y, active.scale, active.height));
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    // Use the release coordinate, not a potentially stale last rendered offset.
    const offset = sheetDragOffset(event.clientY - active.y, active.scale, active.height);
    release(); setIsDragging(false); setDragOffset(0);
    if (offset >= 120) onClose();
  };
  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    release(); setIsDragging(false); setDragOffset(0);
  };
  return { sheetRef, dragOffset, isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel };
}
