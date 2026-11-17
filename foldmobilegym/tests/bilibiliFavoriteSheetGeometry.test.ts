import { describe, expect, it } from 'vitest';
import { favoriteSheetTop, favoriteSheetDragTop, favoriteSheetDrop } from '../apps/Bilibili/utils/favoriteSheetGeometry';
describe('Activity-local favorite sheet geometry', () => {
  it('uses the Activity height rather than the browser window height', () => {
    expect(favoriteSheetTop(864, 'half')).toBe(432);
    expect(favoriteSheetTop(424, 'half')).toBe(212);
    expect(favoriteSheetTop(424, 'closed')).toBe(424);
  });
  it('expands short panes so fixed controls are not clipped', () => {
    expect(favoriteSheetTop(286, 'half')).toBe(40);
    expect(favoriteSheetTop(286, 'full')).toBe(40);
    expect(favoriteSheetTop(100, 'half')).toBe(25);
  });
  it.each([0, 100, 286, 424, 864])('keeps every snap inside a %dpx Activity', height => {
    for (const snap of ['closed', 'half', 'full'] as const) {
      expect(favoriteSheetTop(height, snap)).toBeGreaterThanOrEqual(0);
      expect(favoriteSheetTop(height, snap)).toBeLessThanOrEqual(height);
    }
  });
  it('converts browser movement with the current Activity scale', () => {
    expect(favoriteSheetDragTop(864, 432, 50, 0.5)).toBe(532);
    expect(favoriteSheetDragTop(424, 212, -48, 0.96)).toBe(162);
  });
  it('clamps movement and rejects invalid dimensions', () => {
    expect(favoriteSheetDragTop(424, 212, -1000, 1)).toBe(40);
    expect(favoriteSheetDragTop(424, 212, 1000, 1)).toBe(424);
    expect(favoriteSheetTop(NaN, 'half')).toBe(0);
    expect(favoriteSheetTop(-10, 'full')).toBe(0);
  });
  it('retains existing distance and logical velocity thresholds', () => {
    expect(favoriteSheetDrop(424, 350, 0)).toBe('closed');
    expect(favoriteSheetDrop(424, 212, 0.6)).toBe('closed');
    expect(favoriteSheetDrop(424, 60, 0)).toBe('full');
    expect(favoriteSheetDrop(424, 212, -0.6)).toBe('full');
    expect(favoriteSheetDrop(424, 212, 0)).toBe('half');
  });
});
