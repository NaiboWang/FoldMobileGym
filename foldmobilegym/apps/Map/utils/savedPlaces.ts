export const mapPlaceKey = (place: Record<string, unknown> | null) => place
  ? JSON.stringify([place.place_id ?? null, place.name ?? null, place.formatted_address ?? null]) : '';
export const addSavedPlaceId = (ids: string[] | undefined, id: string) =>
  !id || ids?.includes(id) ? ids ?? [] : [...(ids ?? []), id];
