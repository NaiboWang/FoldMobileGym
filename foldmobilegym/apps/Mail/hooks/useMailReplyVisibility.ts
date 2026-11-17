import {useLayoutEffect, useRef, type RefObject} from 'react';

const textLayout = [
  'boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'fontStretch', 'fontVariant', 'fontKerning', 'fontFeatureSettings',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textAlign', 'textIndent',
  'textTransform', 'direction', 'tabSize', 'wordBreak', 'overflowWrap',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const;

/** Reveal the active text edge within this reply's scroll viewport after resize.
 * Never moves focus/selection, writes a draft, saves, or scrolls another app.
 */
export function useMailReplyVisibility(scrollerRef: RefObject<HTMLDivElement | null>, sourceId: string, ownsSurface: () => boolean) {
  const owner = useRef(ownsSurface);
  owner.current = ownsSurface;
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.setAttribute('data-no-clipboard', 'true');
    mirror.style.cssText = 'all:initial;position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;border-style:solid;border-color:transparent;white-space:pre-wrap;';
    document.body.appendChild(mirror);
    let frame = 0;
    const reveal = () => {
      frame = 0;
      const field = document.activeElement;
      if (!owner.current() || !(field instanceof HTMLTextAreaElement) || !scroller.contains(field)
        || field.disabled || field.readOnly || field.closest('[inert]')) return;
      const box = field.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0 || viewport.height <= 0) return;
      const style = getComputedStyle(field), px = (v: string) => parseFloat(v) || 0;
      if (style.visibility !== 'visible') return;
      for (const key of textLayout) mirror.style[key] = style[key];
      const borderX = px(style.borderLeftWidth) + px(style.borderRightWidth);
      mirror.style.width = `${px(style.width) - Math.max(0, field.offsetWidth - field.clientWidth - borderX)}px`;
      mirror.textContent = field.value + '\u200b';
      const index = field.selectionDirection === 'backward' ? field.selectionStart : field.selectionEnd;
      const range = document.createRange();
      range.setStart(mirror.firstChild!, index);
      if (index > 0 && field.value[index - 1] === '\n') range.setEnd(mirror.firstChild!, index + 1);
      else range.collapse(true);
      const caret = range.getBoundingClientRect(), origin = mirror.getBoundingClientRect();
      if (caret.height <= 0) return;
      // Width changes can reflow the selection outside the textarea itself.
      // Reveal it internally before positioning its actual line in the reply.
      const localTop = caret.top - origin.top - field.clientTop;
      const localBottom = localTop + caret.height;
      const paddingTop = px(style.paddingTop), paddingBottom = px(style.paddingBottom);
      if (localTop < field.scrollTop + paddingTop) field.scrollTop = localTop - paddingTop;
      else if (localBottom > field.scrollTop + field.clientHeight - paddingBottom) {
        field.scrollTop = localBottom - field.clientHeight + paddingBottom;
      }
      const scale = box.height / field.offsetHeight, paneScale = viewport.height / scroller.offsetHeight;
      const top = box.top + (caret.top - origin.top - field.scrollTop) * scale;
      const bottom = top + caret.height * scale;
      const margin = Math.max(0, Math.min(8 * paneScale, (viewport.height - caret.height * scale) / 2));
      const visibleTop = viewport.top + scroller.clientTop * paneScale + margin;
      const visibleBottom = viewport.top + (scroller.clientTop + scroller.clientHeight) * paneScale - margin;
      if (top < visibleTop) scroller.scrollTop += (top - visibleTop) / paneScale;
      else if (bottom > visibleBottom) scroller.scrollTop += (bottom - visibleBottom) / paneScale;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(reveal); };
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    scroller.querySelectorAll('textarea').forEach(field => observer.observe(field));
    for (const event of ['focusin', 'input', 'select', 'keyup']) scroller.addEventListener(event, schedule);
    document.addEventListener('selectionchange', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); mirror.remove();
      for (const event of ['focusin', 'input', 'select', 'keyup']) scroller.removeEventListener(event, schedule);
      document.removeEventListener('selectionchange', schedule);
    };
  }, [scrollerRef, sourceId]);
}
