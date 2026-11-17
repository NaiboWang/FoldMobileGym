import React, { useLayoutEffect, useRef } from 'react';
import { dimens } from '../res/dimens';
import { pad2 } from '../utils';

const PREPEND_WHEEL = 3;

export const WheelColumn: React.FC<{
  value: number;
  label: string;
  options: number[];
  onChange: (value: number) => void;
  /** 计时页使用大号滚轮 */
  large?: boolean;
  /** 闹钟编辑页使用中号滚轮（更大字体） */
  medium?: boolean;
  /** 循环滚轮：首尾相接（时 00 接 23，分 00 接 59） */
  wrap?: boolean;
}> = ({ value, label, options, onChange, large, medium, wrap }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemHeight = large ? dimens.wheel_item_height_large : medium ? dimens.wheel_item_height_medium : dimens.wheel_item_height_small;
  const displayOptions = wrap
    ? [...options.slice(-PREPEND_WHEEL), ...options, ...options.slice(0, PREPEND_WHEEL)]
    : options;
  const scrollIndexForValue = wrap ? PREPEND_WHEEL + options.indexOf(value) : options.indexOf(value);
  const latest = useRef({ value, options, displayOptions, onChange, scrollIndexForValue });
  useLayoutEffect(() => {
    latest.current = { value, options, displayOptions, onChange, scrollIndexForValue };
  });
  const alignRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    let needsAlignment = true;
    const visible = () => el.clientHeight > 0 && el.getClientRects().length > 0;
    const align = () => {
      if (!visible()) { needsAlignment = true; return; }
      const index = latest.current.scrollIndexForValue;
      if (index >= 0) el.scrollTop = index * itemHeight;
      needsAlignment = false;
    };
    alignRef.current = align;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      // display:none (keyboard/tab), resize and reappearance are not input.
      if (!visible()) { needsAlignment = true; return; }
      if (needsAlignment) { align(); return; }
      raf = requestAnimationFrame(() => {
        if (!visible()) { needsAlignment = true; return; }
        if (needsAlignment) { align(); return; }
        const current = latest.current;
        const idx = Math.round(el.scrollTop / itemHeight);
        const clamped = Math.min(current.displayOptions.length - 1, Math.max(0, idx));
        const nextValue = current.displayOptions[clamped];
        if (nextValue === undefined) return;
        const mainStart = wrap ? PREPEND_WHEEL : 0;
        const mainEnd = mainStart + current.options.length - 1;
        if (nextValue !== current.value) current.onChange(nextValue);
        if (wrap && (clamped < mainStart || clamped > mainEnd)) {
          el.scrollTop = (PREPEND_WHEEL + current.options.indexOf(nextValue)) * itemHeight;
        }
      });
    };
    const observer = new ResizeObserver(align);
    observer.observe(el);
    el.addEventListener('scroll', onScroll);
    align();
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      alignRef.current = () => {};
    };
  }, [wrap, itemHeight]);

  // Inline options arrays and ordinary countdown re-renders must not reset a
  // user scroll in progress. Only a selected index/geometry change aligns it.
  useLayoutEffect(() => alignRef.current(), [scrollIndexForValue, itemHeight]);

  const padHeight = large ? dimens.wheel_pad_height_large : medium ? dimens.wheel_pad_height_medium : dimens.wheel_pad_height_small;
  const cellClass = large ? 'h-(--app-wheel-item-height-large) text-[42px]' : medium ? 'h-(--app-wheel-item-height-medium) text-[36px]' : 'h-(--app-wheel-item-height-small) text-[28px]';
  const sizeClass = large ? 'w-(--app-wheel-width-large) h-(--app-wheel-height-large)' : medium ? 'w-(--app-wheel-width-medium) h-(--app-wheel-height-medium)' : 'w-(--app-wheel-width-small) h-(--app-wheel-height-small)';

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !options.length) return;
    const current = options.indexOf(value);
    if (current < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowUp': next = current + 1; break;
      case 'ArrowDown': next = current - 1; break;
      case 'Home': next = 0; break;
      case 'End': next = options.length - 1; break;
      default: return;
    }
    event.preventDefault();
    next = wrap ? (next + options.length) % options.length : Math.max(0, Math.min(options.length - 1, next));
    if (options[next] !== value) onChange(options[next]);
  };

  return (
    <div className={`clock-wheel overflow-y-scroll no-scrollbar ${sizeClass}`} ref={containerRef}
      role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={options[0]} aria-valuemax={options[options.length - 1]}
      aria-valuenow={value} aria-valuetext={pad2(value)} onKeyDown={onKeyDown}>

      <div style={{ height: padHeight }} aria-hidden="true" />
      {displayOptions.map((option, index) => (
        <div
          key={wrap ? `disp-${index}-${option}` : option}
          aria-hidden="true"
          className={`flex items-center justify-center ${cellClass} ${option === value ? 'text-black font-medium' : 'text-gray-300'}`}
        >
          {pad2(option)}
        </div>
      ))}
      <div style={{ height: padHeight }} aria-hidden="true" />
    </div>
  );
};
