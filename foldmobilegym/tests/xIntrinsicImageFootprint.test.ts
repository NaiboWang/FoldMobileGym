import { describe, expect, it } from 'vitest';
import { isXIntrinsicImageSize, readOwnedXImageSize, xIntrinsicAspectRatio } from '../apps/X/utils/intrinsicImageFootprint';
const original = 'https://media.example/image.png', proxy = '/api/gw/proxy?url=' + encodeURIComponent(original), base = 'http://localhost:3188/';
const image = (patch = {}) => ({ src: original, currentSrc: original, naturalWidth: 320, naturalHeight: 480, ...patch });
describe('Real same-source X media geometry, not fabricated source ratios', () => {
  it('accepts genuine original dimensions even before the native request is complete', () => {
    expect(readOwnedXImageSize(image(), [original, proxy], base)).toEqual({ width: 320, height: 480 });
    expect(xIntrinsicAspectRatio({ width: 320, height: 480 })).toBe('320 / 480');
  });
  it('accepts the exact same-source proxy and canonical relative binding', () => {
    expect(readOwnedXImageSize(image({ src: base.slice(0, -1) + proxy, currentSrc: '' }), [original, proxy], base)).toEqual({ width: 320, height: 480 });
    expect(readOwnedXImageSize(image({ currentSrc: new URL(proxy, base).href }), [original, proxy], base)).toEqual({ width: 320, height: 480 });
  });
  it('rejects decoded metadata from an unrelated or replaced source', () => {
    expect(readOwnedXImageSize(image({ currentSrc: 'https://media.example/other.png' }), [original, proxy], base)).toBeNull();
    expect(readOwnedXImageSize(image(), ['https://media.example/next.png'], base)).toBeNull();
    expect(readOwnedXImageSize(image({ currentSrc: 'http://[' }), [original, proxy], base)).toBeNull();
  });
  it.each([{ width: 0, height: 480 }, { width: 320, height: 0 }, { width: -1, height: 20 }, { width: NaN, height: 20 }, { width: 10, height: Infinity }])('does not guess missing/bad geometry: %j', size => {
    expect(isXIntrinsicImageSize(size)).toBe(false); expect(xIntrinsicAspectRatio(size)).toBeUndefined();
    expect(readOwnedXImageSize(image({ naturalWidth: size.width, naturalHeight: size.height }), [original, proxy], base)).toBeNull();
  });
  it('does not invent a ratio for unknown metadata', () => { expect(xIntrinsicAspectRatio()).toBeUndefined(); });
  it('retains wide and tall native ratios rather than a uniform crop', () => {
    expect(xIntrinsicAspectRatio({ width: 320, height: 60 })).toBe('320 / 60');
    expect(xIntrinsicAspectRatio({ width: 60, height: 320 })).toBe('60 / 320');
  });
});
