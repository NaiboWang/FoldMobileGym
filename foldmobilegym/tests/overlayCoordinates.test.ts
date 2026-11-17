import { describe, expect, it } from 'vitest';
import { clientToOverlay } from '../os/utils/overlayCoordinates';

describe('simulator overlay coordinates', () => {
  it('subtracts the centred folded root offset', () => {
    expect(clientToOverlay({ x: 464, y: 363 }, { left: 369, top: 175, width: 402, height: 900, scaleX: 1, scaleY: 1 }))
      .toEqual({ x: 95, y: 188 });
  });
  it('also converts scaled canvases without changing client drag coordinates', () => {
    expect(clientToOverlay({ x: 280, y: 175 }, { left: 100, top: 40, width: 600, height: 900, scaleX: .6, scaleY: .5 }))
      .toEqual({ x: 300, y: 270 });
  });
  it('keeps an origin-aligned unscaled canvas unchanged', () => {
    expect(clientToOverlay({ x: 80, y: 90 }, { left: 0, top: 0, width: 600, height: 900, scaleX: 1, scaleY: 1 }))
      .toEqual({ x: 80, y: 90 });
  });
});
