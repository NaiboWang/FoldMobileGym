import { describe, expect, it } from 'vitest';
import { addSavedPlaceId, mapPlaceKey } from '../apps/Map/utils/savedPlaces';
describe('Map stable saved place identity', () => {
  it('supports older state without a saved collection', () => expect(addSavedPlaceId(undefined, 'east')).toEqual(['east']));
  it('preserves existing IDs and never duplicates a saved place', () => {
    const ids = ['west']; expect(addSavedPlaceId(ids, 'east')).toEqual(['west', 'east']);
    expect(addSavedPlaceId(ids, 'west')).toBe(ids); expect(addSavedPlaceId(ids, '')).toBe(ids);
  });
  it('same-name places differ by ID and address, not rating', () => {
    const source = { place_id: 'east', name: 'Library', formatted_address: 'East', rating: 4 };
    expect(mapPlaceKey(source)).not.toBe(mapPlaceKey({ ...source, place_id: 'west' }));
    expect(mapPlaceKey(source)).not.toBe(mapPlaceKey({ ...source, formatted_address: 'West' }));
    expect(mapPlaceKey(source)).toBe(mapPlaceKey({ ...source, rating: 5 }));
    expect(mapPlaceKey(null)).toBe('');
  });
});
