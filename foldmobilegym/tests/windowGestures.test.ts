import { describe, expect, it } from 'vitest';
import { classifyBottomGesture, previewBottomGesture, splitCardPresentation, clampFloatingBounds, DEFAULT_FLOATING_BOUNDS } from '../os/windowGestures';

describe('bottom diagonal window gestures', () => {
  it('separates left split / right floating from straight home', () => {
    expect(classifyBottomGesture(-210, 240, 830, 900, true)).toBe('split');
    expect(classifyBottomGesture(210, 240, 830, 900, true)).toBe('floating');
    expect(classifyBottomGesture(2, 240, 830, 900, true)).toBe('vertical');
  });
  it('does not treat tiny, horizontal, downward or nearly vertical movement as diagonal', () => {
    for (const [dx, up] of [[10, 10], [200, 12], [200, -200], [91, 500]]) {
      expect(classifyBottomGesture(dx, up, 830, 900, true)).toBe('vertical');
    }
  });
  it('uses the actual scaled device rather than native resolution', () => {
    expect(classifyBottomGesture(-74, 90, 350, 450, true)).toBe('split');
    expect(classifyBottomGesture(74, 90, 350, 450, true)).toBe('floating');
  });
  it('never starts left-right split on the cover display', () => {
    expect(classifyBottomGesture(-120, 200, 401, 900, false)).toBe('vertical');
    expect(classifyBottomGesture(120, 200, 401, 900, false)).toBe('floating');
  });
});

describe('floating window bounds', () => {
  it('keeps its complete toolbar and window inside the device', () => {
    for (const value of [DEFAULT_FLOATING_BOUNDS, { x: -8, y: 4, width: 3, height: 6 }, { x: 9, y: -4, width: -2, height: -5 }]) {
      const next = clampFloatingBounds(value);
      expect(next.x).toBeGreaterThanOrEqual(0);
      expect(next.y).toBeGreaterThanOrEqual(0.04);
      expect(next.x + next.width).toBeLessThanOrEqual(1);
      expect(next.y + next.height).toBeLessThanOrEqual(0.96);
    }
  });
  it('rejects nonfinite dimensions without mutating the input', () => {
    const bounds = { x: NaN, y: Infinity, width: NaN, height: -Infinity };
    expect(clampFloatingBounds(bounds)).toEqual(DEFAULT_FLOATING_BOUNDS);
    expect(bounds.x).toBeNaN();
  });
});


describe('reference-informed split card presentation', () => {
  it('starts at the original surface and follows leftward input without changing the viewport', () => {
    expect(splitCardPresentation(0, 0)).toEqual({x:0,y:0,scale:1,radius:0});
    const card = splitCardPresentation(-0.2,0.2);
    expect(card.x).toBe(-0.2);
    expect(card.scale).toBeGreaterThan(0.78);
    expect(card.scale).toBeLessThan(0.91);
    expect(card.y).toBeGreaterThan(0);
  });
  it('parks a uniformly scaled card with wallpaper above/below and a narrow visible right edge', () => {
    const card = splitCardPresentation(0,0,true);
    expect(card.scale).toBe(0.91);
    expect(card.y).toBe(0.04);
    expect(card.x + card.scale).toBeCloseTo(0.048);
    expect(card.y + card.scale).toBeLessThan(1);
    expect(card.radius).toBe(28);
  });
  it('bounds out-of-range and invalid pointer input without overshooting the parked edge', () => {
    expect(splitCardPresentation(NaN,Infinity)).toEqual(splitCardPresentation(0,0));
    const card = splitCardPresentation(-4,8);
    expect(card.x + card.scale).toBeCloseTo(0.048);
    expect(card.scale).toBe(0.78);
    expect(splitCardPresentation(1,-1)).toEqual(splitCardPresentation(0,0));
  });
});

describe('split visual intent is separate from committing a window', () => {
  it('responds to an early inner-display diagonal without reducing the release threshold', () => {
    expect(previewBottomGesture(-40, 60, 830, 900, true)).toBe('split');
    expect(classifyBottomGesture(-40, 60, 830, 900, true)).toBe('vertical');
    expect(classifyBottomGesture(-70, 85, 830, 900, true)).toBe('vertical');
  });
  it('keeps the same presentation on both sides of the release threshold', () => {
    for (const dx of [-89, -90, -91]) expect(previewBottomGesture(dx, 150, 830, 900, true)).toBe('split');
    const before = splitCardPresentation(-89 / 830, 150 / 900);
    const after = splitCardPresentation(-91 / 830, 150 / 900);
    expect(Math.abs(after.x - before.x) * 830).toBeCloseTo(2);
    expect(after.scale).toBe(before.scale);
  });
  it('does not expose a split for cover, jitter, horizontal or nearly vertical intent', () => {
    for (const [dx, up] of [[-7, 10], [-40, 0], [-40, -50], [-5, 80], [-40, 200], [0, 150]]) {
      expect(previewBottomGesture(dx, up, 830, 900, true)).toBe('vertical');
    }
    expect(previewBottomGesture(-40, 60, 401, 900, false)).toBe('vertical');
    expect(previewBottomGesture(-210, 240, 401, 900, false)).toBe('vertical');
  });
  it('leaves right floating intent and committed diagonals unchanged', () => {
    expect(previewBottomGesture(40, 60, 830, 900, true)).toBe('vertical');
    expect(previewBottomGesture(210, 240, 830, 900, true)).toBe('floating');
    expect(previewBottomGesture(-210, 240, 830, 900, true)).toBe('split');
  });
  it('uses displayed coordinates on a smaller browser host', () => {
    expect(previewBottomGesture(-35, 55, 570, 620, true)).toBe('split');
    expect(classifyBottomGesture(-35, 55, 570, 620, true)).toBe('vertical');
  });
});
