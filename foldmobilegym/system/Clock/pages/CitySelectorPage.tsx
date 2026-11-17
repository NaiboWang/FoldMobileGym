import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WorldCity } from '../types';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useLocale } from '../../../os/locale';
import { IcClose, IcSearch, IcNavBack } from '../res/icons';
import { formatGmtLabel } from '../utils';
import { getCityOptions } from '../citySelector';
import { useClockGestures } from '../hooks/useClockGestures';
import { useSheetDrag } from '../hooks/useSheetDrag';

export const CitySelectorPage: React.FC<{
  cities: WorldCity[];
  selectedCityIds: string[];
  onSelect: (city: WorldCity) => void;
  onClose: () => void;
}> = ({ cities, selectedCityIds, onSelect, onClose }) => {
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const { bindTap, bindBack } = useClockGestures();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const filtered = useMemo(() => getCityOptions(cities, query, s, locale), [cities, query, s, locale]);
  const firstByLetter = useMemo(() => {
    const first = new Map<string, string>();
    for (const option of filtered) if (!first.has(option.initial)) first.set(option.initial, option.city.id);
    return first;
  }, [filtered]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [query, locale]);
  const { sheetRef, dragOffset, isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel } = useSheetDrag(onClose);

  const jumpToLetter = (letter: string) => {
    const id = firstByLetter.get(letter), list = listRef.current;
    const row = id && rows.current.get(id);
    if (list && row) list.scrollTop = row.offsetTop;
  };

  return (
    <div className="absolute inset-0 z-40" data-keep-keyboard="true">
      <div className="absolute inset-0 bg-black/30" {...bindBack()} />
      <div
        ref={sheetRef}
        role="dialog" aria-modal="true" aria-label={s.world_clock_select_city}
        data-clock-dialog="cities"
        className="clock-city-sheet absolute top-10 left-0 right-0 bottom-0 bg-app-bg rounded-t-[24px] px-5 pt-4 pb-6 flex flex-col"
        style={{ transform: `translateY(${dragOffset}px)`, transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="clock-city-drag-handle flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none shrink-0"
          onPointerDown={handlePointerDown}
        >
          <div className="w-16 h-1 rounded-full bg-gray-300 -mt-1.5" aria-hidden />
        </div>
        <div className="flex items-center justify-between mb-3 shrink-0">
          <button className="w-10 h-10 flex items-center justify-center text-app-text-muted shrink-0" aria-label={s.cancel} {...bindBack()}>
            <IcNavBack className="clock-city-close-icon" size={26} />
          </button>
          <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1 px-2">
            <span className="clock-city-sheet-title clock-city-sheet-title-folded text-[20px] font-medium">{s.world_clock_select_city}</span>
            <span className="clock-city-sheet-title clock-city-sheet-title-expanded text-[20px] font-medium">{s.world_clock_timezone_title}</span>
            <span className="clock-city-sheet-subtitle text-[14px] text-gray-400">{s.world_clock_gmt_label}</span>
          </div>
          <div className="w-10 shrink-0" />
        </div>
        <div className="clock-city-search bg-[#f2f2f2] rounded-full px-4 py-3 flex items-center gap-2 mb-4 shrink-0">
          <IcSearch size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            data-action="world.city.search.input" data-action-type="input" data-action-params={JSON.stringify({ value: query })}
            aria-label={s.world_clock_search_placeholder}
            placeholder={s.world_clock_search_city_placeholder}
            className="bg-transparent outline-none text-[16px] flex-1 min-w-0 placeholder:text-gray-400"
          />
          {query ? (
            <button
              className="text-app-primary text-[14px] shrink-0"
              aria-label={s.world_clock_clear_search}
              {...bindTap({ kind: 'action', id: 'world.city.search.clear' }, { onTrigger: () => { setQuery(''); inputRef.current?.focus(); } })}
            >
              <IcClose size={18} />
            </button>
          ) : null}
        </div>
        <div className="flex-1 min-h-0 flex gap-2">
          <div ref={listRef} data-scroll-container="cityPicker" data-scroll-direction="vertical" className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar pr-2">
            {filtered.map(({ city, name, country, initial }) => {
              const isSelected = selectedCityIds.includes(city.id);
              return (
                <button
                  key={city.id}
                  ref={el => { if (el) rows.current.set(city.id, el); else rows.current.delete(city.id); }}
                  data-city-id={city.id} data-city-initial={initial}
                  aria-pressed={isSelected}
                  {...bindTap({ kind: 'action', id: 'world.city.item.add.submit' }, { params: { cityId: city.id }, onTrigger: () => onSelect(city) })}
                  className="w-full py-4 flex items-center justify-between gap-2 text-left border-b border-gray-100 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-[16px] font-medium text-black break-words">{name}</div>
                    <div className="text-[14px] text-gray-400 mt-0.5 break-words">{country} {formatGmtLabel(city.gmtOffsetMinutes)}</div>
                  </div>
                  {isSelected && <span className="text-[12px] text-app-text-muted shrink-0">{s.world_clock_city_added}</span>}
                </button>
              );
            })}
            {filtered.length === 0 && <div role="status" className="text-[14px] text-app-text-muted text-center py-8">{s.world_clock_no_cities}</div>}
          </div>
          <div data-scroll-container="cityIndex" data-scroll-direction="vertical" className="text-[12px] shrink-0 w-6 min-h-0 overflow-y-auto overscroll-contain no-scrollbar">
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(letter => (
              <button
                key={letter} type="button" disabled={!firstByLetter.has(letter)}
                aria-label={letter}
                {...(firstByLetter.has(letter) ? bindTap({ kind: 'action', id: 'world.city.index.jump' }, { params: { letter }, onTrigger: () => jumpToLetter(letter) }) : {})}
                className="block w-full text-center leading-[18px] text-app-primary disabled:text-gray-300"
              >{letter}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
