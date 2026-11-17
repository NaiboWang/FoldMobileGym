export interface XIntrinsicImageSize { width: number; height: number }
export function isXIntrinsicImageSize(size: XIntrinsicImageSize): boolean {
  return !!size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}
/** Metadata is accepted only from the current original/proxy source, never another image. */
export function readOwnedXImageSize(image: Pick<HTMLImageElement, 'currentSrc' | 'src' | 'naturalWidth' | 'naturalHeight'>,
  sources: readonly (string | null | undefined)[], base: string): XIntrinsicImageSize | null {
  const size = { width: image.naturalWidth, height: image.naturalHeight };
  if (!isXIntrinsicImageSize(size)) return null;
  try {
    const actual = new URL(image.currentSrc || image.src, base).href;
    if (!sources.some(source => { if (!source) return false; try { return new URL(source, base).href === actual; } catch { return false; } })) return null;
    return size;
  } catch { return null; }
}
export const xIntrinsicAspectRatio = (size?: XIntrinsicImageSize) => size && isXIntrinsicImageSize(size) ? size.width + ' / ' + size.height : undefined;
