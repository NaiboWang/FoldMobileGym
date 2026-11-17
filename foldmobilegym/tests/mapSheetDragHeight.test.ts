import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {clampSheetDragHeight} from '../apps/Map/utils/sheetDragHeight';
describe('Map sheet tracks pointer heights at bounds',()=>{
 it('clamps upper overshoot instead of retaining the previous height',()=>{
  expect(clampSheetDragHeight(1000,56,800)).toBe(800);
 });
 it('clamps lower overshoot instead of retaining the previous height',()=>{
  expect(clampSheetDragHeight(-20,56,800)).toBe(56);
 });
 it('preserves movement within bounds and fractional heights',()=>{
  expect(clampSheetDragHeight(166.75,56,800)).toBe(166.75);
 });
 it('works with an optional upper bound',()=>{
  expect(clampSheetDragHeight(1000,56)).toBe(1000);
  expect(clampSheetDragHeight(0,56)).toBe(56);
 });
 it('updates the live ref before rendering and after snapping',()=>{
  const source=readFileSync(new URL('../apps/Map/hooks/useDraggableSheet.ts',import.meta.url),'utf8');
  expect(source).toMatch(/heightRef\.current = newHeight;\s*setHeight\(newHeight\)/);
  expect(source).toMatch(/heightRef\.current = best;\s*setHeight\(best\)/);
 });
});
