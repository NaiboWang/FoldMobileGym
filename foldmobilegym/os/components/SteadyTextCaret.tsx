import React, { useEffect, useRef } from 'react';
import { SIMULATOR_CONFIG } from '../data';
import { clientToOverlay, simulatorOverlayViewport } from '../utils/overlayCoordinates';

type TextField = HTMLInputElement | HTMLTextAreaElement;
const markerAttribute = 'data-steady-text-caret';
const layoutProperties = [
  'boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'fontStretch', 'fontVariant', 'fontKerning', 'fontFeatureSettings',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign', 'textIndent',
  'textTransform', 'textRendering', 'direction', 'tabSize', 'wordBreak',
  'overflowWrap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const;

function isTextField(el: Element | null): el is TextField {
  return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    && !el.disabled && !el.readOnly && el.selectionStart !== null;
}

/** A visual caret only: the real field retains focus, selection, IME and editing. */
export const SteadyTextCaret: React.FC = () => {
  const caretRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const caret = caretRef.current!;
    const root = document.getElementById('root');
    const mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.setAttribute('data-no-clipboard', 'true');
    mirror.style.cssText = 'all:initial;position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;border-style:solid;border-color:transparent;';
    document.body.appendChild(mirror);
    let field: TextField | null = null;
    let color = '';
    let frame = 0;
    let signature = '';
    let localRect: { x: number; y: number; height: number; width: number; boxHeight: number } | null = null;

    const release = () => {
      field?.removeAttribute(markerAttribute);
      field = null;
      signature = '';
      localRect = null;
      caret.style.display = 'none';
    };

    const update = () => {
      frame = 0;
      const active = document.activeElement;
      if (!isTextField(active) || !root?.contains(active) || !document.hasFocus()) {
        release();
        return;
      }
      if (field !== active) {
        release();
        field = active;
        const style = getComputedStyle(field);
        color = style.caretColor === 'auto' ? style.color : style.caretColor;
      }
      // Only run while a supported editor has focus. Tracking each frame also
      // covers CSS zoom, keyboard resize and fold transitions without app hooks.
      frame = requestAnimationFrame(update);
      const style = getComputedStyle(field);
      const box = field.getBoundingClientRect();
      if (field.selectionStart !== field.selectionEnd || box.width <= 0 || box.height <= 0
        || style.visibility !== 'visible' || style.opacity === '0') {
        caret.style.display = 'none';
        return;
      }
      const index = field.selectionStart!;
      const values = layoutProperties.map(key => style[key]);
      const wraps = field instanceof HTMLTextAreaElement && field.wrap !== 'off';
      const nextSignature = JSON.stringify([field.value, index, field instanceof HTMLTextAreaElement, wraps, field.clientWidth, field.clientHeight, ...values]);
      if (nextSignature !== signature) {
        signature = nextSignature;
        for (const key of layoutProperties) mirror.style[key] = style[key];
        const multiline = field instanceof HTMLTextAreaElement;
        mirror.style.whiteSpace = wraps ? 'pre-wrap' : 'pre';
        // clientWidth excludes a textarea's vertical scrollbar. Account for it
        // when measuring wrapping, while preserving subpixel widths otherwise.
        const px = (v: string) => parseFloat(v) || 0;
        const paddingX = px(style.paddingLeft) + px(style.paddingRight);
        const borderX = px(style.borderLeftWidth) + px(style.borderRightWidth);
        const paddingY = px(style.paddingTop) + px(style.paddingBottom);
        const borderY = px(style.borderTopWidth) + px(style.borderBottomWidth);
        const borderBoxWidth = px(style.width) + (style.boxSizing === 'border-box' ? 0 : paddingX + borderX);
        const borderBoxHeight = px(style.height) + (style.boxSizing === 'border-box' ? 0 : paddingY + borderY);
        const scrollbar = Math.max(0, field.offsetWidth - field.clientWidth - borderX);
        mirror.style.width = `${px(style.width) - scrollbar}px`;
        // Native single-line inputs vertically centre the text in the content box.
        if (!multiline) mirror.style.lineHeight = `${Math.max(1, borderBoxHeight - paddingY - borderY)}px`;
        // A trailing zero-width character gives empty/trailing-newline fields a
        // measurable line. A Range preserves full-text alignment and word wrap.
        mirror.textContent = (field.type === 'password' ? '•'.repeat(field.value.length) : field.value) + '\u200b';
        const range = document.createRange();
        range.setStart(mirror.firstChild!, index);
        // A collapsed DOM Range immediately after a newline may report the end
        // of the previous line, whereas textarea editing uses the new line.
        if (index > 0 && field.value[index - 1] === '\n') range.setEnd(mirror.firstChild!, index + 1);
        else range.collapse(true);
        const measured = range.getBoundingClientRect();
        const origin = mirror.getBoundingClientRect();
        localRect = measured.height > 0 ? {
          x: measured.left - origin.left, y: measured.top - origin.top,
          height: measured.height, width: borderBoxWidth, boxHeight: borderBoxHeight,
        } : null;
      }
      if (!localRect || localRect.width <= 0 || localRect.boxHeight <= 0) {
        // Retain the native caret if the browser cannot measure this field.
        field.removeAttribute(markerAttribute);
        caret.style.display = 'none';
        return;
      }
      const sx = box.width / localRect.width;
      const sy = box.height / localRect.boxHeight;
      const x = box.left + (localRect.x - field.scrollLeft) * sx;
      const y = box.top + (localRect.y - field.scrollTop) * sy;
      let left = box.left + field.clientLeft * sx;
      let right = left + field.clientWidth * sx;
      let top = box.top + field.clientTop * sy;
      let bottom = top + field.clientHeight * sy;
      // Clip against scrolling panes and the screen so a caret cannot leak into
      // a neighbouring app, keyboard or a hidden/backgrounded application.
      for (let parent = field.parentElement; parent; parent = parent.parentElement) {
        const ps = getComputedStyle(parent);
        if (ps.visibility !== 'visible' || ps.opacity === '0') { bottom = top; break; }
        const bounds = parent.getBoundingClientRect();
        if (/(hidden|clip|auto|scroll)/.test(ps.overflowX)) {
          left = Math.max(left, bounds.left); right = Math.min(right, bounds.right);
        }
        if (/(hidden|clip|auto|scroll)/.test(ps.overflowY)) {
          top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom);
        }
        // The fixed simulator root is the screen boundary. The document body
        // may have zero layout height; its overflow is applied to the viewport.
        if (parent === root) break;
      }
      top = Math.max(top, y); bottom = Math.min(bottom, y + localRect.height * sy);
      const hit = document.elementFromPoint(Math.min(right - 1, Math.max(left + 1, x)), (top + bottom) / 2);
      if (bottom <= top || x < left - 1 || x > right + 1 || hit !== field) {
        caret.style.display = 'none';
        return;
      }
      const viewport = simulatorOverlayViewport();
      const point = clientToOverlay({ x: Math.min(right - sx, Math.max(left, x)), y: top }, viewport);
      caret.style.left = `${point.x}px`;
      caret.style.top = `${point.y}px`;
      caret.style.width = `${Math.max(1, 1.5 * sx) / viewport.scaleX}px`;
      caret.style.height = `${(bottom - top) / viewport.scaleY}px`;
      caret.style.backgroundColor = color;
      caret.style.display = 'block';
      // Hide the blinking native line only after its replacement is measurable.
      field.setAttribute(markerAttribute, 'true');
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    document.addEventListener('focusin', schedule);
    window.addEventListener('focus', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', schedule);
      window.removeEventListener('focus', schedule);
      release();
      mirror.remove();
    };
  }, []);

  return <>
    <style>{`[${markerAttribute}="true"] { caret-color: transparent !important; }`}</style>
    <div ref={caretRef} data-system-text-caret aria-hidden="true" data-no-clipboard="true"
      style={{ display: 'none', position: 'fixed', pointerEvents: 'none',
        zIndex: SIMULATOR_CONFIG.framework.zIndexKeyboard - 1 }} />
  </>;
};
