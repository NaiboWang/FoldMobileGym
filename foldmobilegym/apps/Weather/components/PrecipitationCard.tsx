import React from 'react';
import { colors } from '../res/colors';
import type { strings } from '../res/strings';

/** Display only the supplied forecast; missing data is not a dry-weather forecast. */
export const PrecipitationCard: React.FC<{ summary: string; strings: typeof strings }> = ({ summary, strings: s }) => (
  <div className="px-[11px] mb-4" data-weather-precipitation>
    <div className="backdrop-blur-md border rounded-xl p-4 text-white h-28 flex justify-between items-center relative overflow-hidden"
      style={{ backgroundColor: colors.card_surface, borderColor: colors.card_border }}>
      <div className="z-10">
        <div className="text-sm opacity-70 mb-1">{s.precipitation_forecast_title}</div>
        <div className="text-xl font-medium mb-1">{summary.trim() || s.precipitation_unavailable}</div>
      </div>
      <div className="w-24 h-24 rounded-lg" style={{ background: `linear-gradient(to bottom right, ${colors.precip_bg_start}, ${colors.precip_bg_end})` }} />
    </div>
  </div>
);
