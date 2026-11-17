import { describe, expect, it } from 'vitest';
import { clampSheetDragOffset, sheetDragOffset } from '../system/Clock/utils';

describe('Clock sheet follows current pointer offset', () => {
  it('converts reduced and enlarged app surfaces back to CSS coordinates', () => {
    expect(sheetDragOffset(70, .5, 900)).toBe(140);
    expect(sheetDragOffset(70, 2, 900)).toBe(35);
    expect(sheetDragOffset(70, .814, 900) * .814).toBeCloseTo(70);
  });
  it('uses the app sheet height instead of the browser viewport as its bound', () => {
    expect(sheetDragOffset(900, .5, 600)).toBe(600);
    expect(sheetDragOffset(-40, .5, 600)).toBe(0);
  });
  it('does not produce invalid transforms from non-renderable geometry', () => {
    for (const scale of [0, -1, NaN, Infinity]) expect(sheetDragOffset(70, scale, 600)).toBe(0);
    expect(sheetDragOffset(NaN, 1, 600)).toBe(0);
    expect(sheetDragOffset(70, 1, Infinity)).toBe(0);
  });
  it('resets at the exact origin after crossing a dismissal threshold', () => {
    expect([150, 0].map(delta => clampSheetDragOffset(delta, 1000))).toEqual([150, 0]);
  });
  it('resets above the origin rather than retaining the last positive value', () => {
    expect([150, -20].map(delta => clampSheetDragOffset(delta, 1000))).toEqual([150, 0]);
  });
  it('preserves a downward drag inside the bound', () => {
    expect(clampSheetDragOffset(60, 1000)).toBe(60);
    expect(clampSheetDragOffset(150, 1000)).toBe(150);
  });
  it('caps downward movement at the viewport bound', () => {
    expect(clampSheetDragOffset(1200, 1000)).toBe(1000);
    expect(clampSheetDragOffset(1, 0)).toBe(0);
  });
  it('preserves fractional CSS offsets without quantization', () => {
    expect(clampSheetDragOffset(18.75, 1000)).toBe(18.75);
    expect(clampSheetDragOffset(-0.25, 1000)).toBe(0);
  });
});
