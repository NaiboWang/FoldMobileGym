/** Browser-side probe. Native intersections include clipping scroll ancestors. */
async function probeVisibleImages({ selector, timeoutMs, once }) {
    const started = performance.now();
    const deadline = performance.now() + timeoutMs;
    let stableFrames = 0, lastSignature = '';
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // A load/error event can resolve before React commits a fallback or proxy src.
    // Re-query the actual visible DOM after commits rather than trusting old nodes.
    do {
      await frames();
      const root = document.querySelector(selector);
      if (!root) throw new Error('Missing image diagnostic root: ' + selector);
      const frame = root.getBoundingClientRect();
      const candidates = [...root.querySelectorAll('img')].filter(image => {
        const r = image.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > frame.top && r.top < frame.bottom
          && r.right > frame.left && r.left < frame.right && (image.currentSrc || image.getAttribute('src'));
      });
      const visible = await new Promise((resolve, reject) => {
        if (!candidates.length) { resolve([]); return; }
        const entries = new Map();
        const observer = new IntersectionObserver(batch => {
          for (const entry of batch) entries.set(entry.target, entry);
          if (entries.size !== candidates.length) return;
          window.clearTimeout(timer); observer.disconnect();
          resolve(candidates.filter(image => {
            const entry = entries.get(image);
            return root.contains(image) && entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0;
          }));
        });
        const timer = window.setTimeout(() => { observer.disconnect(); reject(new Error('Timed out measuring image intersections')); }, Math.max(1, Math.min(2000, deadline - performance.now())));
        candidates.forEach(image => observer.observe(image));
      });
      const signature = JSON.stringify([root.scrollHeight, root.textContent?.length, root.querySelectorAll('*').length,
        visible.map(image => { const r = image.getBoundingClientRect(); return [image.currentSrc || image.getAttribute('src'), Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)]; })]);
      const healthy = visible.every(image => image.complete && image.naturalWidth > 0);
      const failedImages = visible.filter(image => !image.complete || !image.naturalWidth).map(image => image.currentSrc || image.getAttribute('src'));
      if (once) return { settled: healthy, failedImages, imageCount: visible.length, elapsedMs: performance.now() - started };
      stableFrames = healthy ? (signature === lastSignature ? stableFrames + 1 : 1) : 0;
      lastSignature = signature;
      // Virtual lists can expose the next image after a fallback changes height.
      if (stableFrames >= 4) return {
        settled: true, elapsedMs: performance.now() - started,
        imageCount: visible.length, rootImageCount: root.querySelectorAll('img').length,
        fontStatus: document.fonts.status, documentReadyState: document.readyState,
        activeAnimations: root.getAnimations({ subtree: true }).length,
      };
    } while (performance.now() < deadline);
    // Do not hide, remove or whitelist failed images. The caller still asserts
    // actual completion/naturalWidth and reports persistent failures normally.
    return { settled: false, elapsedMs: performance.now() - started };
}

/** Bounded browser diagnostic: allow async error handlers to replace broken images. */
export async function waitForVisibleImages(page, selector, timeoutMs = 12000) {
  return await page.evaluate(probeVisibleImages, { selector, timeoutMs, once: false });
}

/** Fresh health assertion sample with the same physical visibility definition. */
export async function readVisibleImageHealth(page, selector) {
  return await page.evaluate(probeVisibleImages, { selector, timeoutMs: 2000, once: true });
}
