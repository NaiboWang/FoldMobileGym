import type { SyntheticEvent } from 'react';

// A neutral, local fallback for invalid or unavailable product photos.
const placeholderSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#f3f4f6"/><rect x="92" y="58" width="136" height="124" rx="12" fill="none" stroke="#9ca3af" stroke-width="8"/><circle cx="137" cy="100" r="13" fill="#9ca3af"/><path d="m108 157 36-37 24 22 20-17 25 32" fill="none" stroke="#9ca3af" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const placeholderUrl = `data:image/svg+xml,${encodeURIComponent(placeholderSvg)}`;

export function showImageFallback(event: SyntheticEvent<HTMLImageElement, Event>): void {
  const image = event.currentTarget;
  // The same <img> can be reused for another product; guard the fallback URL,
  // not a permanent data flag on the element.
  if (image.src.startsWith('data:image/svg+xml,')) return;
  image.src = placeholderUrl;
}
