import { describe, expect, it } from 'vitest';
import { pinchTransform, pointerPair, MAX_VIEWER_SCALE, type PinchGeometry } from '../system/Gallery/pinchGeometry';
const geometry: PinchGeometry = { center: { x: 400, y: 400 }, hostScale: 1, imageWidth: 600, imageHeight: 600, width: 600, height: 600 };
const initial = { scale: 1, position: { x: 0, y: 0 } };
const pair = (half: number, x = 400, y = 400) => pointerPair({ x: x - half, y }, { x: x + half, y });
describe('continuous Gallery pinch geometry', () => {
  it('uses the real distance ratio and leaves a centred gesture centred', () => {
    expect(pinchTransform(initial, pair(50), pair(90), geometry)).toEqual({ scale: 1.8, position: { x: 0, y: 0 } });
  });
  it('keeps the selected image point under an off-centre, moving centroid', () => {
    const result = pinchTransform(initial, pair(50, 450, 420), pair(100, 470, 440), geometry);
    expect(result.scale).toBe(2);
    // physical = hostScale * scale * (image point + position) + base centre
    expect(2 * (50 + result.position.x) + 400).toBe(470);
    expect(2 * (20 + result.position.y) + 400).toBe(440);
  });
  it('includes the existing zoom/translation and CSS host scale', () => {
    const result = pinchTransform({ scale: 2, position: { x: 30, y: -10 } }, pair(25, 425), pair(37.5, 440), { ...geometry, hostScale: .5 });
    expect(result.scale).toBe(3);
    expect(result.position.x).toBeCloseTo(30 + 40 / 1.5 - 25);
    expect(result.position.y).toBe(-10);
  });
  it('clamps at 1x and the supported upper bound rather than overshooting', () => {
    expect(pinchTransform(initial, pair(50), pair(500), geometry).scale).toBe(MAX_VIEWER_SCALE);
    expect(pinchTransform({ scale: 2, position: { x: 80, y: 60 } }, pair(50), pair(0), geometry)).toEqual(initial);
  });
  it('centres a fitting axis and clamps overflowing axes at actual image edges', () => {
    const result = pinchTransform(initial, pair(50), pair(100, 2000, 2000), { ...geometry, imageHeight: 100 });
    expect(result.position).toEqual({ x: 150, y: 0 });
  });
  it('rejects invalid/hidden geometry or coincident starting fingers without changing input', () => {
    expect(pinchTransform(initial, pair(0), pair(40), geometry)).toBe(initial);
    expect(pinchTransform(initial, pair(50), pair(80), { ...geometry, hostScale: 0 })).toBe(initial);
    expect(pinchTransform(initial, pair(50), pair(NaN), geometry)).toBe(initial);
    expect(pinchTransform(initial, pair(50), pair(80), { ...geometry, width: 0 })).toBe(initial);
  });
});
