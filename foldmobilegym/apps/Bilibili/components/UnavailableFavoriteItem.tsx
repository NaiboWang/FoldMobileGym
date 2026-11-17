import React from 'react';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';

/** This is a retained local record whose metadata is not in the loaded catalog. */
export const UnavailableFavoriteItem: React.FC<{ id: string }> = ({ id }) => {
  const strings = useBilibiliStrings();
  return (
    <div data-favorite-entry-id={id} className="flex gap-3 px-4 py-3 border-b border-app-bg text-app-text-muted">
      <div className="w-[140px] aspect-video bg-app-bg rounded-md shrink-0" aria-hidden="true" />
      <div className="text-[14px]">{strings.favorite_video_unavailable}</div>
    </div>
  );
};
