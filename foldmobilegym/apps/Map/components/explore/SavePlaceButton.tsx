import React from 'react';
import { useActivityId } from '../../../../os/ActivityContext';
import { useMapStore } from '../../state';
import { useMapStrings } from '../../hooks/useMapStrings';
import { useMapGestures } from '../../hooks/useMapGestures';
import { IcBookmark } from '../../res/icons';
import { mapPlaceKey } from '../../utils/savedPlaces';

export const SavePlaceButton: React.FC<{ placeId: string; disabled?: boolean; compact?: boolean; className: string }> = ({ placeId, disabled, compact, className }) => {
  const ids = useMapStore(state => state.savedPlaceIds), poi = useMapStore(state => state.currentView.poi);
  const save = useMapStore(state => state.savePlace), activityId = useActivityId(), { bindTap } = useMapGestures(), s = useMapStrings();
  const saved = ids?.includes(placeId) ?? false, key = mapPlaceKey(poi);
  return <button type="button" className={className} disabled={disabled || !placeId || poi?.place_id !== placeId}
    aria-pressed={saved} aria-label={saved ? s.action_saved : s.action_save}
    {...bindTap({ kind: 'action', id: 'map.place.save' }, { params: { placeId }, onTrigger: () => {
      const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
      if (!disabled && top?.activityId === activityId && !os?.isLauncherVisible && !os?.isRecentsVisible) save(placeId, key);
    } })}><IcBookmark size={compact ? 20 : 16} fill={saved ? 'currentColor' : 'none'} />{!compact && (saved ? s.action_saved : s.action_save)}</button>;
};
