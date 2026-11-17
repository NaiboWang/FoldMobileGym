import React, { useState } from 'react';
import { IcClock, IcNavArrow } from '../res/icons';
import { splitWeekdayDescriptionLine } from '../utils/placeUtils';
import { useMapStrings } from '../hooks/useMapStrings';

export const HoursCard: React.FC<{
  isOpen: boolean;
  isKnown?: boolean;
  isAlwaysOpen?: boolean;
  closesAt: string | null;
  opensNextLabel: string | null;
  weekdayDescriptions?: string[];
}> = ({ isOpen, isKnown = true, isAlwaysOpen = false, closesAt, opensNextLabel, weekdayDescriptions }) => {
  const [expanded, setExpanded] = useState(false);
  const s = useMapStrings();
  const lines = weekdayDescriptions ?? [];
  const canExpand = lines.length > 0;
  return (
    <div className="bg-gray-50 rounded-2xl px-4 py-3.5" data-map-hours-card="true">
      <button
        type="button"
        disabled={!canExpand}
        aria-label={s.place_opening_hours}
        aria-expanded={canExpand ? expanded : undefined}
        className="flex items-start gap-3.5 w-full text-left"
        onClick={() => canExpand && setExpanded(!expanded)}
      >
        <IcClock className="text-gray-500 mt-0.5 shrink-0" size={20} />
        <div className="text-sm flex-1 min-w-0">
          <span className={!isKnown ? 'text-app-text-muted' : isOpen ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
            {!isKnown ? s.place_hours_unknown : isAlwaysOpen ? s.place_open_24_hours : isOpen ? s.place_open_now : s.place_closed_now}
          </span>
          {isOpen && closesAt && <span className="text-gray-600"> · {s.place_closes_at}{closesAt}</span>}
          {!isOpen && opensNextLabel && <span className="text-gray-600"> · {s.place_opens_at}{opensNextLabel}</span>}
        </div>
        {canExpand ? (
          <IcNavArrow
            className={`text-gray-400 shrink-0 mt-0.5 transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`}
            size={18}
          />
        ) : null}
      </button>
      {expanded && lines.length > 0 && (
        <div className="mt-3 ml-[34px] space-y-2">
          {lines.map((desc, i) => {
            const { left, right } = splitWeekdayDescriptionLine(desc);
            return (
              <div key={i} className={`flex text-sm ${right != null ? 'justify-between gap-3' : ''}`}>
                {right != null ? (
                  <>
                    <span className="text-gray-700 shrink-0">{left}</span>
                    <span className="text-gray-600 text-right">{right}</span>
                  </>
                ) : (
                  <span className="text-gray-600">{desc}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
