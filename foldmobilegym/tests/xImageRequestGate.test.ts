import { describe, expect, it } from 'vitest';
import { permittedXImageSource, ownsXImageBinding } from '../apps/X/utils/imageRequestGate';
const direct = 'https://example.test/original.jpg', proxy = '/api/gw/proxy?url=' + encodeURIComponent(direct);
describe('X exact transport request permission', () => {
  it('does not initiate a transfer before a visible lease authorizes its exact URI', () => {
    expect(permittedXImageSource(direct, undefined, undefined)).toBeUndefined();
    expect(permittedXImageSource(direct, direct, undefined)).toBe(direct);
  });
  it('does not reuse direct permission for the future proxy phase', () => {
    expect(permittedXImageSource(proxy, direct, undefined)).toBeUndefined();
    expect(permittedXImageSource(proxy, proxy, undefined)).toBe(proxy);
  });
  it('does not reuse old source permission after replacement', () => {
    expect(permittedXImageSource('https://example.test/replaced.jpg', direct, undefined)).toBeUndefined();
  });
  it('pins an already decoded owned image even if another consumer fails', () => {
    expect(permittedXImageSource(proxy, undefined, direct)).toBe(direct);
  });
  it.each([null, undefined, ''])('does not issue a request for an absent source: %s', desired => {
    expect(permittedXImageSource(desired, undefined, undefined)).toBeUndefined();
  });
  it('accepts actual binding only when the desired and authorized sources both match', () => {
    expect(ownsXImageBinding(direct, direct, direct)).toBe(true);
    expect(ownsXImageBinding(proxy, proxy, proxy)).toBe(true);
    expect(ownsXImageBinding(null, direct, direct)).toBe(false);
    expect(ownsXImageBinding(direct, proxy, proxy)).toBe(false);
    expect(ownsXImageBinding(direct, direct, undefined)).toBe(false);
  });
});
