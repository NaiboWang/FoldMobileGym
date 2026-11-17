import { describe, expect, it } from 'vitest';
import { haveWatchedElementsChanged } from '../apps/Ebay/hooks/useScrollDirection';

describe('eBay scroll observer', () => {
  it('detects replacement of a scroll container even when the count stays the same', () => {
    const oldPage = {} as HTMLElement;
    const newPage = {} as HTMLElement;
    const documentScroll = {} as HTMLElement;
    expect(haveWatchedElementsChanged([oldPage, documentScroll], [newPage, documentScroll])).toBe(true);
    expect(haveWatchedElementsChanged([oldPage, documentScroll], [oldPage, documentScroll])).toBe(false);
  });

  it('detects added or removed scroll containers', () => {
    const page = {} as HTMLElement;
    expect(haveWatchedElementsChanged([page], [])).toBe(true);
    expect(haveWatchedElementsChanged([], [page])).toBe(true);
  });
});
