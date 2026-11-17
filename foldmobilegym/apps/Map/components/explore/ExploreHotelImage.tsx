import React, { useState } from 'react';
import { useMapStrings } from '../../hooks/useMapStrings';
import { IcImage } from '../../res/icons';

/** Keep the real source; unavailable external media is an explicit localized empty state. */
export function ExploreHotelImage({ src }: { src: string }) {
  const s = useMapStrings();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === src) {
    return (
      <div data-map-image-fallback role="img" aria-label={s.place_no_photo}
        className="h-56 w-full rounded mb-2 bg-gray-100 text-app-text-muted flex flex-col items-center justify-center gap-2">
        <IcImage size={28} aria-hidden="true" />
        <span className="text-sm">{s.place_no_photo}</span>
      </div>
    );
  }
  return (
    <img src={src} alt={s.explore_accommodation} loading="lazy" referrerPolicy="no-referrer"
      className="h-56 w-full object-cover rounded mb-2" onError={() => setFailedSource(src)} />
  );
}
