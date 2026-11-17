import { describe, expect, it } from 'vitest';
import type { SyntheticEvent } from 'react';
import { showImageFallback } from '../os/utils/imageFallback';

describe('product image fallback', () => {
  it('recovers a failed image without blocking a later image on the same element', () => {
    const image = { src: '/cdn/taobao/images/broken-a.jpg' } as HTMLImageElement;
    const event = { currentTarget: image } as SyntheticEvent<HTMLImageElement, Event>;

    showImageFallback(event);
    expect(image.src).toMatch(/^data:image\/svg\+xml,/);

    image.src = '/cdn/taobao/images/broken-b.jpg';
    showImageFallback(event);
    expect(image.src).toMatch(/^data:image\/svg\+xml,/);

    const placeholder = image.src;
    showImageFallback(event);
    expect(image.src).toBe(placeholder);
  });
});
