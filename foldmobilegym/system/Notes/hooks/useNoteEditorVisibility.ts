import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

const textLayout = [
  'boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'fontStretch', 'fontVariant', 'fontKerning', 'fontFeatureSettings',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign', 'textIndent',
  'textTransform', 'direction', 'tabSize', 'wordBreak', 'overflowWrap',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const;

/** Keep the selected line inside this editor when the keyboard/pane resizes.
 * A textarea can be taller than a split pane: revealing its outer box does not
 * reveal its caret. Never scroll another app or move focus/selection here.
 */
export function useNoteEditorVisibility(scrollerRef: RefObject<HTMLDivElement | null>, routeId?: string) {
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.setAttribute('data-no-clipboard', 'true');
    mirror.style.cssText = 'all:initial;position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;border-style:solid;border-color:transparent;';
    document.body.appendChild(mirror);
    let frame = 0;
    const reveal = () => {
      frame = 0;
      const field = document.activeElement;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
        || !scroller.contains(field) || field.disabled || field.readOnly
        || field.selectionStart === null || field.closest('[inert]')) return;
      const box = field.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || viewport.height <= 0) return;
      const style = getComputedStyle(field), px = (v: string) => parseFloat(v) || 0;
      if (style.visibility !== 'visible') return;
      for (const key of textLayout) mirror.style[key] = style[key];
      const multiline = field instanceof HTMLTextAreaElement;
      mirror.style.whiteSpace = multiline && field.wrap !== 'off' ? 'pre-wrap' : 'pre';
      const borderX = px(style.borderLeftWidth) + px(style.borderRightWidth);
      const borderY = px(style.borderTopWidth) + px(style.borderBottomWidth);
      const paddingY = px(style.paddingTop) + px(style.paddingBottom);
      const height = px(style.height) + (style.boxSizing === 'border-box' ? 0 : paddingY + borderY);
      if (height <= 0) return;
      mirror.style.width = `${px(style.width) - Math.max(0, field.offsetWidth - field.clientWidth - borderX)}px`;
      if (!multiline) mirror.style.lineHeight = `${Math.max(1, height - paddingY - borderY)}px`;
      mirror.textContent = field.value + '\u200b';
      const index = field.selectionDirection === 'backward' ? field.selectionStart : (field.selectionEnd ?? field.selectionStart);
      const range = document.createRange();
      range.setStart(mirror.firstChild!, index);
      if (index > 0 && field.value[index - 1] === '\n') range.setEnd(mirror.firstChild!, index + 1);
      else range.collapse(true);
      const caret = range.getBoundingClientRect(), origin = mirror.getBoundingClientRect();
      if (caret.height <= 0) return;
      const fieldScale = box.height / height;
      const top = box.top + (caret.top - origin.top - field.scrollTop) * fieldScale;
      const bottom = top + caret.height * fieldScale;
      const paneScale = viewport.height / scroller.offsetHeight;
      const margin = Math.min(8 * paneScale, viewport.height / 4);
      const visibleTop = viewport.top + scroller.clientTop * paneScale + margin;
      const visibleBottom = viewport.top + (scroller.clientTop + scroller.clientHeight) * paneScale - margin;
      if (top < visibleTop) scroller.scrollTop += (top - visibleTop) / paneScale;
      else if (bottom > visibleBottom) scroller.scrollTop += (bottom - visibleBottom) / paneScale;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(reveal); };
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    for (const event of ['focusin', 'input', 'select', 'keyup']) scroller.addEventListener(event, schedule);
    document.addEventListener('selectionchange', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); mirror.remove();
      for (const event of ['focusin', 'input', 'select', 'keyup']) scroller.removeEventListener(event, schedule);
      document.removeEventListener('selectionchange', schedule);
    };
  }, [scrollerRef, routeId]);
}
