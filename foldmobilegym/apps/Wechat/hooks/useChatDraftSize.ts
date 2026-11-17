import {useLayoutEffect, type RefObject} from 'react';

const textLayout = [
  'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch',
  'fontVariant', 'fontKerning', 'fontFeatureSettings', 'letterSpacing', 'wordSpacing',
  'lineHeight', 'textAlign', 'textIndent', 'textTransform', 'direction', 'tabSize',
  'wordBreak', 'overflowWrap', 'paddingTop', 'paddingRight', 'paddingBottom',
  'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const;

/** Grow within existing resource limits and this Activity's resized body.
 * Geometry only: never changes draft, focus, selection, identity or keyboard.
 */
export function useChatDraftSize(
  fieldRef: RefObject<HTMLTextAreaElement | null>,
  bodyRef: RefObject<HTMLDivElement | null>,
  value: string,
  routeId?: string,
) {
  useLayoutEffect(() => {
    const field = fieldRef.current, body = bodyRef.current;
    if (!field || !body) return;
    const bar = field.closest<HTMLElement>('[data-keep-keyboard]');
    if (!bar) return;
    const mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.setAttribute('data-no-clipboard', 'true');
    mirror.style.cssText = 'all:initial;position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;border-style:solid;border-color:transparent;';
    document.body.appendChild(mirror);
    const px = (v: string) => parseFloat(v) || 0;
    let frame = 0;
    const resize = () => {
      frame = 0;
      if (!field.isConnected || field.getBoundingClientRect().width <= 0 || body.clientHeight <= 0) return;
      const style = getComputedStyle(field), oldScroll = field.scrollTop;
      const minimum = px(style.minHeight), maximum = px(style.maxHeight);
      const line = px(style.lineHeight), padding = px(style.paddingTop) + px(style.paddingBottom);
      const border = px(style.borderTopWidth) + px(style.borderBottomWidth);
      const messages = body.querySelector<HTMLElement>('[data-scroll-container="main"]');
      const messageStyle = messages ? getComputedStyle(messages) : null;
      const reserve = line + (messageStyle ? px(messageStyle.paddingTop) + px(messageStyle.paddingBottom) : 0);
      const chrome = bar.offsetHeight - field.offsetHeight;
      const siblings = [...body.children].filter(e => e !== bar && e !== messages)
        .reduce((sum, e) => sum + (e as HTMLElement).offsetHeight, 0);
      const limit = Math.max(minimum, Math.min(maximum, body.clientHeight - chrome - siblings - reserve));
      field.style.height = 'auto';
      const desired = field.scrollHeight + border;
      const height = Math.max(minimum, Math.min(limit, desired));
      field.style.height = `${style.boxSizing === 'border-box' ? height : height - padding - border}px`;
      field.scrollTop = oldScroll;
      if (document.activeElement !== field || field.closest('[inert]') || field.disabled) return;
      // Measure the actual active edge, including wraps/newlines. Do not force the
      // end of the draft into view when the user is editing a middle selection.
      for (const key of textLayout) mirror.style[key] = style[key];
      mirror.style.width = `${field.clientWidth}px`;
      mirror.style.boxSizing = 'border-box';
      mirror.style.borderWidth = '0';
      mirror.textContent = field.value + '\u200b';
      const index = field.selectionDirection === 'backward' ? field.selectionStart : field.selectionEnd;
      const range = document.createRange();
      range.setStart(mirror.firstChild!, index);
      if (index > 0 && field.value[index - 1] === '\n') range.setEnd(mirror.firstChild!, index + 1);
      else range.collapse(true);
      const caret = range.getBoundingClientRect(), origin = mirror.getBoundingClientRect();
      if (caret.height <= 0) return;
      const top = caret.top - origin.top, bottom = caret.bottom - origin.top;
      if (top < field.scrollTop + px(style.paddingTop)) field.scrollTop = top - px(style.paddingTop);
      else if (bottom > field.scrollTop + field.clientHeight - px(style.paddingBottom)) {
        field.scrollTop = bottom - field.clientHeight + px(style.paddingBottom);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(resize); };
    const observer = new ResizeObserver(schedule);
    observer.observe(body); observer.observe(field);
    for (const event of ['focus', 'select', 'keyup']) field.addEventListener(event, schedule);
    document.addEventListener('selectionchange', schedule);
    resize();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); mirror.remove();
      for (const event of ['focus', 'select', 'keyup']) field.removeEventListener(event, schedule);
      document.removeEventListener('selectionchange', schedule);
    };
  }, [fieldRef, bodyRef, value, routeId]);
}
