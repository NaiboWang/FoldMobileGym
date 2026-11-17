import React from 'react';
import { IcNavBack } from '../res/icons';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';

/** Missing IDs must never resolve to another person's or another folder's content. */
export const MissingFavoriteFolder: React.FC = () => {
  const { bindBack } = useBilibiliGestures();
  const s = useBilibiliStrings();
  return (
    <div className="flex flex-col h-full bg-app-surface" data-bili-missing-folder>
      <div className="h-10 shrink-0" />
      <div className="px-4 py-2">
        <button type="button" {...bindBack()} aria-label={s.favorite_folder_back} className="flex items-center gap-2 text-app-text">
          <IcNavBack size={24} /><span>{s.favorite_folder_back}</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-2 px-6 text-center" data-scroll-container="main" data-scroll-direction="vertical">
        <h1 className="text-[17px] font-medium text-app-text">{s.favorite_folder_unavailable}</h1>
        <p className="text-[13px] text-app-text-muted">{s.favorite_folder_unavailable_detail}</p>
      </div>
    </div>
  );
};
