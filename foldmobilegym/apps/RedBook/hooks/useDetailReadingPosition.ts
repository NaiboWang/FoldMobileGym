import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

// A volatile DOM bookmark, scoped to this mounted post, never business data.
// Preserve progress within a block rather than copying pixels across reflow.
export function useDetailReadingPosition(
  wide: boolean,
  content: RefObject<HTMLDivElement | null>,
  article: RefObject<HTMLDivElement | null>,
) {
  const bookmark = useRef<{ element: HTMLElement; fraction: number } | null>(null);
  const restoring = useRef(false);
  const previousWide = useRef(wide);
  const remember = useCallback(() => {
    const body = article.current, owner = wide ? body : content.current;
    if (!body || !owner || owner.clientHeight === 0) return;
    const top = owner.getBoundingClientRect().top;
    // While reading media, do not jump past it on a later fold.
    if (body.getBoundingClientRect().top > top + 24) {
      bookmark.current = null;
      return;
    }
    const blocks = [...body.querySelectorAll<HTMLElement>(
      ':scope > h2, :scope > p, :scope > hr, [data-reading-comment]',
    )];
    const block = blocks.find(e => e.getBoundingClientRect().bottom > top + 1);
    if (!block) return;
    const rect = block.getBoundingClientRect();
    bookmark.current = { element: block, fraction: Math.max(0, Math.min(1, (top - rect.top) / Math.max(1, rect.height))) };
  }, [wide, content, article]);

  useLayoutEffect(() => {
    if (previousWide.current !== wide && bookmark.current) restoring.current = true;
    previousWide.current = wide;
    const body = article.current, wrapper = content.current;
    if (!body || !wrapper) return;
    const restore = () => {
      const saved = bookmark.current, owner = wide ? body : wrapper;
      if (!restoring.current || !saved || !body.contains(saved.element) || owner.clientHeight === 0) return;
      const viewport = owner.getBoundingClientRect(), rect = saved.element.getBoundingClientRect();
      const scale = viewport.height / owner.clientHeight;
      if (scale > 0) owner.scrollTop += (rect.top + rect.height * saved.fraction - viewport.top) / scale;
    };
    // Device/pane transitions resize over several frames. Keep the original
    // bookmark through those frames; never learn from our own scroll writes.
    restore();
    const observer = new ResizeObserver(restore);
    observer.observe(body); observer.observe(wrapper);
    const resume = () => { restoring.current = false; remember(); };
    wrapper.addEventListener('pointerdown', resume, true);
    wrapper.addEventListener('wheel', resume, true);
    wrapper.addEventListener('keydown', resume, true);
    return () => {
      observer.disconnect();
      wrapper.removeEventListener('pointerdown', resume, true);
      wrapper.removeEventListener('wheel', resume, true);
      wrapper.removeEventListener('keydown', resume, true);
    };
  }, [wide, content, article, remember]);

  // Scroll events from the inactive (display:contents/non-scrollable) owner
  // must not overwrite the bookmark while React switches layout ownership.
  return useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!restoring.current && event.target === (wide ? article.current : content.current)) remember();
  }, [wide, article, content, remember]);
}
