import { describe, expect, it } from 'vitest';
import { getRouteSheetLayout } from '../apps/Map/utils/routeSheetLayout';
describe('Map route Activity geometry', () => {
    it('uses actual Activity width, including narrow split on an unfolded screen', () => {
        expect(getRouteSheetLayout(599, 800).wide).toBe(false);
        expect(getRouteSheetLayout(600, 800).wide).toBe(true);
        expect(getRouteSheetLayout(416, 800).wide).toBe(false);
    });
    it('uses Activity height rather than the host browser', () => {
        expect(getRouteSheetLayout(390, 380)).toEqual({ wide: false, collapsed: 155, medium: 300, full: 332 });
    });
    it.each([0, 20, 48, 100, 180, 250, 400, 800])('keeps every snap ordered and inside a %i px Activity', height => {
        const { collapsed, medium, full } = getRouteSheetLayout(390, height);
        expect(collapsed).toBeGreaterThanOrEqual(0);
        expect(medium).toBeGreaterThanOrEqual(collapsed);
        expect(full).toBeGreaterThanOrEqual(medium);
        expect(full).toBeLessThanOrEqual(height);
    });
});
