import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { IcNavBack, IcSwapAlt, IcFilter, IcClock, IcCalendar, IcExpand, IcLoader, IcCoins, IcClipboard, EllipsisIcon, DirectRouteIcon } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useShallow } from 'zustand/react/shallow';
import type { TrainFilter, SortMode } from '../services/trainService';
import { SEAT_FILTER_OPTIONS, TIME_RANGES, applyFilterAndSort } from '../services/trainService';
import { queryTrainStops, type StopInfo } from '../services/railwayApi';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { useRailwayDialogFocus, trapRailwayDialogFocus } from '../hooks/useRailwayDialogFocus';
import { QuerySwapDialog } from '../components/QuerySwapDialog';
import * as TimeService from '../../../os/TimeService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';

import type { TrainInfo } from '../types';
type TransferSortMode = 'default' | 'duration' | 'depart';

/** 铺位/卧铺席别名称（用于判断是否显示"铺"标签） */
const BERTH_SEAT_TYPES = ['硬卧', '软卧', '动卧', '高软', '一等卧', '二等卧'];

// Helper for station type badge style
const getStationTypeBadge = (type: string) => {
  if (type === '始') {
    return "text-[10px] text-white bg-app-accent px-1 rounded-sm leading-tight";
  }
  if (type === '终') {
    return "text-[10px] text-white bg-[#4CAF50] px-1 rounded-sm leading-tight";
  }
  return "text-[10px] text-app-primary border border-app-primary px-0.5 rounded-sm leading-tight";
};

/** 计算经停时长（分钟） */
function computeStopMinutes(arrive: string, depart: string): string {
  if (arrive === '----' || depart === '----') return '-';
  const [ah, am] = arrive.split(':').map(Number);
  const [dh, dm] = depart.split(':').map(Number);
  const diff = (dh * 60 + dm) - (ah * 60 + am);
  if (diff <= 0) return '-';
  return `${diff}分`;
}

function parseDurationMinutes(duration: string): number {
  const hourMatch = duration.match(/(\d+)小时/);
  const minMatch = duration.match(/(\d+)分/);
  return (hourMatch ? parseInt(hourMatch[1]) * 60 : 0) + (minMatch ? parseInt(minMatch[1]) : 0);
}

/** 计算高级筛选激活项数 */
function getAdvancedFilterCount(filter: TrainFilter): number {
  let count = 0;
  if (filter.trainGroupTypes?.length) count += filter.trainGroupTypes.length;
  if (filter.seatTypes?.length) count += filter.seatTypes.length;
  if (filter.fromStations?.length) count += 1;
  if (filter.toStations?.length) count += 1;
  if (filter.onlyDepartureStation) count += 1;
  if (filter.onlyTerminalStation) count += 1;
  if (filter.depTimeRanges?.length) count += 1;
  if (filter.arrTimeRanges?.length) count += 1;
  return count;
}

/** 判断车次是否有卧铺席别 */
function hasBerthSeats(train: TrainInfo): boolean {
  return train.seats.some(s => BERTH_SEAT_TYPES.some(bt => s.type.includes(bt)));
}

// ─── 筛选面板组件 ─────────────────────────────────────────────────
interface FilterPanelProps {
  filter: TrainFilter;
  onConfirm: (f: TrainFilter) => boolean;
  returnFocus: React.RefObject<HTMLElement | null>;
  fromStationOptions: string[];
  toStationOptions: string[];
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filter, onConfirm, returnFocus, fromStationOptions, toStationOptions }) => {
  const [temp, setTemp] = useState<TrainFilter>({ ...filter });
  const { bindBack, bindTap, back } = useRailwayGestures();
  const panel = useRef<HTMLDivElement>(null), submitted = useRef(false);
  useRailwayDialogFocus(panel, returnFocus);

  const s = useAppStrings(strings, stringsEn);

  // 切片 toggle 辅助函数
  const toggleArrayItem = useCallback((key: keyof TrainFilter, value: string | number) => {
    setTemp(prev => {
      const arr = (prev[key] as (string | number)[] | undefined) || [];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...prev, [key]: next.length > 0 ? next : undefined };
    });
  }, []);

  const toggleBool = useCallback((key: keyof TrainFilter) => {
    setTemp(prev => ({ ...prev, [key]: !prev[key] || undefined }));
  }, []);

  const clearAll = () => {
    setTemp({
      onlyHighSpeed: filter.onlyHighSpeed,
      onlyRegular: filter.onlyRegular,
      onlyAvailable: filter.onlyAvailable,
    });
  };

  const optionBinding = (key: keyof TrainFilter, value: string | number | undefined, checked: boolean) => ({
    'aria-pressed': checked,
    ...bindTap({ kind: 'action', id: 'query.filter.option.toggle' }, { params: { key, value: value === undefined ? '' : String(value) }, onTrigger: () => {
      if (key === 'onlyHighSpeed') setTemp(previous => ({ ...previous, onlyHighSpeed: !previous.onlyHighSpeed, onlyRegular: false }));
      else if (key === 'onlyRegular') setTemp(previous => ({ ...previous, onlyRegular: !previous.onlyRegular, onlyHighSpeed: false }));
      else if (key === 'onlyAvailable') setTemp(previous => ({ ...previous, onlyAvailable: !previous.onlyAvailable }));
      else if (value === undefined) toggleBool(key);
      else toggleArrayItem(key, value);
    } }),
  });

  // 选中样式
  const tagCls = (active: boolean) =>
    `px-3 py-2 rounded-lg text-sm text-center ${active ? 'bg-[#E8F2FF] text-app-primary border border-app-primary' : 'bg-app-bg text-gray-700 border border-transparent'}`;

  return (
    <div className="railway-query-overlay absolute inset-0 z-[70]" data-status-bar-foreground="light">
      {/* 遮罩 */}
      <button type="button" tabIndex={-1} aria-label={s.action_cancel} className="absolute inset-0 bg-black/40" {...bindBack()} />
      {/* 面板 */}
      <div ref={panel} role="dialog" aria-modal="true" aria-label={s.filter_btn} onKeyDown={event => trapRailwayDialogFocus(event, back)} className="railway-query-filter-panel absolute bottom-0 left-0 right-0 bg-app-surface rounded-t-2xl flex flex-col animate-slide-up">
        {/* 顶部 */}
        <div className="px-4 py-3 flex-shrink-0">
          <button className="text-gray-600 text-sm" {...bindBack()}>{s.action_cancel}</button>
        </div>

        {/* 可滚动内容 */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" data-scroll-container="filter" data-scroll-direction="vertical">
          {/* 车次类型 */}
          <div className="mb-5">
            <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_train_type}</div>
            <div className="grid grid-cols-3 gap-2">
              <button className={tagCls(!!temp.onlyHighSpeed)} {...optionBinding('onlyHighSpeed', undefined, !!temp.onlyHighSpeed)}>{s.filter_type_high_speed}</button>
              <button className={tagCls(!!temp.onlyRegular)} {...optionBinding('onlyRegular', undefined, !!temp.onlyRegular)}>{s.filter_type_regular}</button>
              <button className={tagCls(!!temp.onlyAvailable)} {...optionBinding('onlyAvailable', undefined, !!temp.onlyAvailable)}>{s.filter_only_available}</button>
            </div>
          </div>

          {/* 车组类型 */}
          <div className="mb-5">
            <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_train_group}</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'fux', label: '复兴号' },
                { key: 'smart', label: '智能动车' },
                { key: 'dynamic', label: '动感号' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={tagCls(!!temp.trainGroupTypes?.includes(key))}
                  {...optionBinding('trainGroupTypes', key, !!temp.trainGroupTypes?.includes(key))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 席别类型 */}
          <div className="mb-5">
            <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_seat_type}</div>
            <div className="grid grid-cols-3 gap-2">
              {SEAT_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt}
                  className={tagCls(!!temp.seatTypes?.includes(opt))}
                  {...optionBinding('seatTypes', opt, !!temp.seatTypes?.includes(opt))}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* 出发车站 */}
          {fromStationOptions.length > 0 && (
            <div className="mb-5">
              <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_from_station}</div>
              <div className="flex flex-wrap gap-2">
                {fromStationOptions.map(stn => (
                  <button
                    key={stn}
                    className={tagCls(!!temp.fromStations?.includes(stn))}
                    {...optionBinding('fromStations', stn, !!temp.fromStations?.includes(stn))}
                  >
                    {stn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 到达车站 */}
          {toStationOptions.length > 0 && (
            <div className="mb-5">
              <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_to_station}</div>
              <div className="flex flex-wrap gap-2">
                {toStationOptions.map(stn => (
                  <button
                    key={stn}
                    className={tagCls(!!temp.toStations?.includes(stn))}
                    {...optionBinding('toStations', stn, !!temp.toStations?.includes(stn))}
                  >
                    {stn}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 其他筛选 */}
          <div className="mb-5">
            <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_other}</div>
            <div className="grid grid-cols-3 gap-2">
              <button className={tagCls(!!temp.onlyDepartureStation)} {...optionBinding('onlyDepartureStation', undefined, !!temp.onlyDepartureStation)}>{s.filter_only_departure}</button>
              <button className={tagCls(!!temp.onlyTerminalStation)} {...optionBinding('onlyTerminalStation', undefined, !!temp.onlyTerminalStation)}>{s.filter_only_terminal}</button>
            </div>
          </div>

          {/* 出发时间 */}
          <div className="mb-5">
            <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_dep_time}</div>
            <div className="grid grid-cols-2 gap-2">
              {TIME_RANGES.map((tr, i) => (
                <button
                  key={`dep-${i}`}
                  className={tagCls(!!temp.depTimeRanges?.includes(i))}
                  {...optionBinding('depTimeRanges', i, !!temp.depTimeRanges?.includes(i))}
                >
                  {tr.name} {tr.label}
                </button>
              ))}
            </div>
          </div>

          {/* 到达时间 */}
          <div className="mb-5">
            <div className="text-app-primary text-sm font-medium mb-3">{s.filter_section_arr_time}</div>
            <div className="grid grid-cols-2 gap-2">
              {TIME_RANGES.map((tr, i) => (
                <button
                  key={`arr-${i}`}
                  className={tagCls(!!temp.arrTimeRanges?.includes(i))}
                  {...optionBinding('arrTimeRanges', i, !!temp.arrTimeRanges?.includes(i))}
                >
                  {tr.name} {tr.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="shrink-0 bg-app-surface border-t border-gray-100 flex gap-3 px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <button className="flex-1 py-3 rounded-full border border-gray-300 text-gray-600 text-base" {...bindTap({ kind: 'action', id: 'query.filter.clear' }, { onTrigger: clearAll })}>{s.filter_clear}</button>
          <button className="flex-1 py-3 rounded-full bg-app-primary text-white text-base" {...bindTap({ kind: 'action', id: 'query.filter.apply.submit' }, { onTrigger: () => { if (submitted.current) return; submitted.current = onConfirm(temp); } })}>{s.filter_confirm}</button>
        </div>
      </div>
    </div>
  );
};

// ─── 经停站时间线组件 ─────────────────────────────────────────────────
interface StopsTimelineProps {
  stops: StopInfo[];
  fromStation: string;
  toStation: string;
}

const StopsTimeline: React.FC<StopsTimelineProps> = ({ stops, fromStation, toStation }) => {
  // 找到出发站和到达站的索引
  const fromIdx = stops.findIndex(s => s.station_name === fromStation);
  const toIdx = stops.findIndex(s => s.station_name === toStation);

  return (
    <div className="border-t border-gray-100">
      {/* 表头 */}
      <div className="flex items-center py-2 text-[12px] text-gray-400 font-medium bg-[#F8FAFB] pr-4">
        <div className="w-[110px] pl-6">站名</div>
        <div className="flex-1 text-center">到时</div>
        <div className="flex-1 text-center">发时</div>
        <div className="w-[50px] text-right">停留</div>
      </div>
      {/* 站点列表 */}
      <div className="max-h-[320px] overflow-y-auto no-scrollbar">
        {stops.map((st, i) => {
          const isFrom = st.station_name === fromStation;
          const isTo = st.station_name === toStation;
          // 已经过的站: fromIdx 之前的站（不含 fromStation 自身）
          const isPassed = fromIdx >= 0 && i < fromIdx;
          // 活跃站: fromStation ~ toStation（含两端）
          const isActive = fromIdx >= 0 && toIdx >= 0 && i >= fromIdx && i <= toIdx;
          // 文字颜色
          const textColor = isPassed ? 'text-gray-400' : isActive ? 'text-app-primary' : 'text-gray-700';
          const fontWeight = (isFrom || isTo) ? 'font-semibold' : 'font-normal';
          // 圆点颜色
          const dotColor = isPassed ? 'bg-gray-300' : 'bg-app-primary';
          const dotSize = (isFrom || isTo) ? 'w-2 h-2' : 'w-1.5 h-1.5';
          // 竖线颜色
          const isFirst = i === 0;
          const isLast = i === stops.length - 1;

          const stopMin = computeStopMinutes(st.arrive_time, st.start_time);

          return (
            <div key={i} className="flex items-stretch relative" style={{ minHeight: 36 }}>
              {/* 左侧时间线 */}
              <div className="w-6 flex flex-col items-center relative flex-shrink-0">
                {/* 上半段竖线 */}
                {!isFirst && (
                  <div
                    className={`absolute top-0 w-px ${i <= fromIdx ? 'bg-gray-300' : 'bg-app-primary'}`}
                    style={{ height: '50%' }}
                  />
                )}
                {/* 圆点 */}
                <div className={`absolute top-1/2 -translate-y-1/2 rounded-full z-10 ${dotColor} ${dotSize}`} />
                {/* 下半段竖线 */}
                {!isLast && (
                  <div
                    className={`absolute bottom-0 w-px ${i < fromIdx ? 'bg-gray-300' : 'bg-app-primary'}`}
                    style={{ height: '50%' }}
                  />
                )}
              </div>
              {/* 站点信息 */}
              <div className="flex-1 flex items-center py-1.5 pr-4">
                <div className={`w-[84px] text-[13px] ${textColor} ${fontWeight} truncate`}>
                  {st.station_name}
                </div>
                <div className={`flex-1 text-center text-[13px] ${textColor} ${fontWeight}`}>
                  {st.arrive_time === '----' ? '----' : st.arrive_time}
                </div>
                <div className={`flex-1 text-center text-[13px] ${textColor} ${fontWeight}`}>
                  {st.start_time === '----' ? '----' : st.start_time}
                </div>
                <div className={`w-[50px] text-right text-[13px] ${textColor}`}>
                  {st.arrive_time === '----' || st.start_time === '----' ? '-----' : stopMin}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

type BindTapFn = ReturnType<typeof useRailwayGestures>['bindTap'];

interface TrainCardProps {
  train: TrainInfo;
  index: number;
  directIndex: number;
  date: string;
  isExpanded: boolean;
  onToggle: (index: number) => void;
  onSelectSeat: (train: TrainInfo, seatType: string, directIndex: number) => void;
  bindTap: BindTapFn;
  bookingEnabled: boolean;
}

const TrainCard: React.FC<TrainCardProps> = React.memo(({
  train,
  index,
  directIndex,
  date,
  isExpanded,
  onToggle,
  onSelectSeat,
  bindTap, bookingEnabled,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const availableSeats = train.seats.filter(seat => seat.count > 0 && seat.price > 0);
  const allPricedSeats = train.seats.filter(seat => seat.price > 0);
  const minAvailablePrice = availableSeats.length > 0
    ? Math.min(...availableSeats.map(seat => seat.price))
    : train.saleTime && allPricedSeats.length > 0
      ? Math.min(...allPricedSeats.map(seat => seat.price))
      : null;

  const [showStops, setShowStops] = useState(false);
  const [stops, setStops] = useState<StopInfo[]>([]);
  const [stopsLoading, setStopsLoading] = useState(false);

  const handleToggleStops = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showStops) { setShowStops(false); return; }
    if (!train.trainNoInternal) return;
    // 展开经停站时收起座位详情
    if (isExpanded) onToggle(index);
    setShowStops(true);
    if (stops.length > 0) return;
    setStopsLoading(true);
    try {
      const data = await queryTrainStops(train.trainNoInternal, date);
      setStops(data);
    } catch { /* ignore */ }
    setStopsLoading(false);
  }, [showStops, stops.length, train.trainNoInternal, date, isExpanded, onToggle, index]);

  return (
    <div data-railway-train={train.trainNo} data-railway-train-index={directIndex} className="bg-app-surface mx-3 mt-1.5 rounded-lg shadow-sm relative overflow-hidden">
      {/* 标签行 - 绝对定位到左上角 */}
      {train.tags && train.tags.length > 0 && (
        <div className="absolute top-0 left-0 flex z-10">
          {train.tags.map(tag => (
            <span key={tag} className="text-[10px] text-app-accent bg-[#FFF3DF] px-1.5 py-0.5 rounded-br-lg font-medium leading-none">{tag}</span>
          ))}
        </div>
      )}

      <div
        className="w-full text-left flex items-start justify-between active:bg-gray-50 px-3 pt-4 pb-2 cursor-pointer"
        onClick={() => { setShowStops(false); onToggle(index); }}
      >
        {/* 出发 */}
        <div className="w-[66px]">
          <div className="text-[22px] font-semibold text-black leading-none mb-0.5">{train.departTime}</div>
          <div className="text-[11px] text-gray-600 flex items-center gap-0.5">
            {train.fromType && <span className={getStationTypeBadge(train.fromType)}>{train.fromType}</span>}
            <span className="truncate">{train.fromStation}</span>
          </div>
        </div>

        {/* 车次+时长 — 点击展开经停站 */}
        <div
          className="text-center flex-1 px-1 mt-1 cursor-pointer"
          onClick={handleToggleStops}
        >
          <div className="flex items-center justify-center gap-0.5 mb-1.5">
            <span className="text-[13px] font-medium text-black">{train.trainNo}</span>
            {train.exchangeable && <span className="text-[9px] text-app-primary bg-[#E8F2FF] px-0.5 py-[1px] rounded leading-none">{s.tag_exchangeable}</span>}
            {hasBerthSeats(train) && <span className="text-[9px] text-app-accent bg-[#FFF3E0] px-0.5 py-[1px] rounded leading-none">{s.tag_berth}</span>}
            {train.quiet && <span className="text-[9px] text-app-accent bg-[#FFF3E0] px-0.5 py-[1px] rounded leading-none">{s.tag_quiet}</span>}
          </div>
          <div className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5">
            <span>{train.duration}</span>
            <IcExpand
              size={10}
              className={`${showStops ? 'rotate-180' : ''}`}
              style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }}
            />
          </div>
        </div>

        {/* 到达 */}
        <div className="text-right w-[66px]">
          <div className="text-[22px] font-semibold text-black leading-none mb-0.5">
            {train.arriveTime}
            {train.nextDay && <span className="text-[9px] text-app-accent align-top ml-0.5">+1</span>}
          </div>
          <div className="text-[11px] text-gray-600 flex items-center justify-end gap-0.5">
            {train.toType && <span className={getStationTypeBadge(train.toType)}>{train.toType}</span>}
            <span className="truncate">{train.toStation}</span>
          </div>
        </div>

        {/* 价格 */}
        <div className="text-right w-[75px] flex flex-col items-end justify-center">
          {minAvailablePrice !== null ? (
            <div className="text-app-accent font-bold text-[17px] leading-none mb-0.5">
              <span className="text-[11px] font-normal mr-0.5">¥</span>
              {minAvailablePrice}
              <span className="text-[11px] font-normal ml-0.5">{s.price_from_suffix}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">{s.seat_sold_out}</span>
          )}
        </div>
      </div>

      {/* 席别余票 - 展开时隐藏（展开区替代显示） */}
      {!isExpanded && (
        <>
        <div className="px-3 pb-1 pt-0 flex flex-wrap gap-x-1 gap-y-1">
          {train.seats.map(seat => {
            const canWL = seat.count <= 0 && seat.canWaitlist;
            return (
              <div key={seat.type} className="text-[11px] flex items-center gap-0.5 min-w-[72px]">
                <span className="text-gray-600">{seat.type}</span>
                {train.saleTime ? (
                  <span className="text-gray-400">*</span>
                ) : seat.count > 0 ? (
                  <span className="text-[#00C853]">
                    {!Number.isFinite(seat.count) ? s.seat_available : `${seat.count}${s.seat_count_suffix}`}
                  </span>
                ) : canWL ? (
                  <>
                    <span className="text-app-primary">{s.seat_waitlist}</span>
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-app-primary text-white text-[9px] font-bold leading-none">+</span>
                  </>
                ) : (
                  <span className="text-gray-400">{s.seat_none}</span>
                )}
              </div>
            );
          })}
        </div>
        {train.saleTime && (
          <div className="px-3 pb-1.5">
            <span className="text-[11px] text-app-accent font-medium">{train.saleTime}起售</span>
          </div>
        )}
        </>
      )}

      {/* 展开：座位详情 + 预订按钮 */}
      {isExpanded && (
        <div className="mx-3 mb-1 rounded-xl border border-[#E8EDF3] overflow-hidden">
          {train.seats.filter(s => s.price > 0).map((seat) => {
            const bookable = seat.count > 0;
            const waitlistable = seat.count === -1 || (seat.count === 0 && seat.canWaitlist);
            const hasBerth = seat.berthPrices && seat.berthPrices.length > 0;
            return (
              <div key={seat.type} className={`border-b border-[#EEF2F6] last:border-b-0 bg-app-surface ${hasBerth ? 'pb-1.5' : ''}`}>
                {/* 主行 */}
                <div className="h-(--app-seat-detail-row-height) px-3 flex items-center">
                  <span className="w-12 text-[16px] font-medium text-[#2D3542]">{seat.type}</span>
                  <span className="text-[16px] text-[#D68A2A]">¥{seat.price}</span>
                  {/* 折扣标签 */}
                  {seat.discount && seat.discount < 100 && (
                    <span className="ml-1.5 text-[11px] text-app-text-muted border border-[#DDD] rounded px-1 py-[1px] leading-none">
                      {seat.discount % 10 === 0 ? `${seat.discount / 10}${s.seat_discount_suffix}` : `${seat.discount / 10}${s.seat_discount_suffix}`}
                    </span>
                  )}
                  <span className={`flex-1 text-right text-[16px] mr-3 ${bookable ? 'text-[#3FAE6E]' : waitlistable ? 'text-[#B9C0CA]' : 'text-[#B9C0CA]'}`}>
                    {bookable ? (!isFinite(seat.count) ? s.seat_available : `${seat.count}${s.seat_count_suffix}`) : waitlistable ? s.seat_sold_out : s.seat_none}
                  </span>
                  {bookable ? (
                    <button
                      disabled={!bookingEnabled} className="w-(--app-seat-detail-book-btn-w) h-(--app-seat-detail-book-btn-h) rounded-lg bg-app-primary text-white text-[15px] disabled:opacity-40"
                      {...bindTap<HTMLButtonElement>('trainDetail.book', {
                        params: { idx: directIndex, seat: seat.type },
                        onTrigger: () => onSelectSeat(train, seat.type, directIndex),
                      })}
                    >
                      {s.seat_book_btn}
                    </button>
                  ) : waitlistable ? (
                    <button className="w-(--app-seat-detail-book-btn-w) h-(--app-seat-detail-book-btn-h) rounded-lg bg-[#F48B24] text-white text-[15px] flex items-center justify-center gap-0.5">
                      <span>{s.seat_waitlist}</span>
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-app-surface/30 text-[11px] font-bold leading-none">+</span>
                    </button>
                  ) : (
                    <button
                      className="w-(--app-seat-detail-book-btn-w) h-(--app-seat-detail-book-btn-h) rounded-lg border border-[#D9D9D9] text-[#B9C0CA] text-[15px] bg-app-surface"
                      disabled
                    >
                      {s.seat_book_btn}
                    </button>
                  )}
                </div>
                {/* 铺位分价行 */}
                {hasBerth && (
                  <div className="px-3 pb-1 flex items-center text-[11px] text-app-text-muted gap-0">
                    {seat.berthPrices!.map((bp, bpIdx) => (
                      <span key={bp.position} className="flex items-center">
                        {bpIdx > 0 && <span className="mx-1.5 text-[#DDD]">|</span>}
                        <span>{bp.position}</span>
                        <span className="ml-0.5">¥{bp.price}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 经停站列表 — 展开式时间线（在座次信息下方，占满卡片宽度） */}
      {showStops && (
        <div className="pb-1">
          {stopsLoading ? (
            <div className="flex items-center justify-center py-3">
              <IcLoader size={16} className="text-app-primary animate-spin" />
              <span className="text-[11px] text-gray-400 ml-1">加载中...</span>
            </div>
          ) : stops.length > 0 ? (
            <StopsTimeline stops={stops} fromStation={train.fromStation} toStation={train.toStation} />
          ) : (
            <div className="text-center text-[11px] text-gray-400 py-3">暂无经停信息</div>
          )}
        </div>
      )}
    </div>
  );
}, (prev, next) => (
  prev.train === next.train
  && prev.index === next.index
  && prev.directIndex === next.directIndex
  && prev.date === next.date
  && prev.isExpanded === next.isExpanded
  && prev.bookingEnabled === next.bookingEnabled
  && prev.onSelectSeat === next.onSelectSeat
  && prev.onToggle === next.onToggle
));

// ─── 主页面组件 ───────────────────────────────────────────────────
export const QueryResultPage: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const { from, to, date, directTrains, transferPlans, queryLoading: loading, queryError: error } = useRailwayStore(useShallow(s => ({
    from: s.from, to: s.to, date: s.date,
    directTrains: s.directTrains, transferPlans: s.transferPlans,
    queryLoading: s._temp.queryLoading, queryError: s._temp.queryError,
  })));
  const executeQuery = useRailwayStore(s => s.executeQuery);
  const executeTransferQuery = useRailwayStore(s => s.executeTransferQuery);
  const setSelectedTrain = useRailwayStore(s => s.setSelectedTrain);
  const setDate = useRailwayStore(s => s.setDate);
  const swapStations = useRailwayStore(s => s.swapStations);
  const { bindBack, bindTap, go, back } = useRailwayGestures();
  const s = useAppStrings(strings, stringsEn);
  const [searchParams] = useSearchParams();
  const location = useLocation(), activityId = useActivityId();
  const mounted = useRef(true), liveKey = useRef(location.key), dialogOpener = useRef<HTMLElement | null>(null);
  liveKey.current = location.key;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const activeTab = searchParams.get('tab') === 'transfer' ? 'transfer' : 'direct';
  const showFilterPanel = isActive && searchParams.get('filterPanel') === 'open';
  const [filter, setFilter] = useState<TrainFilter>({});
  const [sort, setSort] = useState<SortMode>('depart');
  const [transferSort, setTransferSort] = useState<TransferSortMode>('default');
  const [expandedTrainIndex, setExpandedTrainIndex] = useState<number | null>(null);
  const showSwapDialog = isActive && searchParams.get('swapDialog') === 'open';
  const modalOpen = showFilterPanel || showSwapDialog;
  const queryKey = JSON.stringify([from, to, date]), expandedQuery = useRef(queryKey);
  const resultScroll = useRef<HTMLDivElement>(null);
  const submittedRequest = (location.state as { railwayQueryRequest?: number } | null)?.railwayQueryRequest;
  const observedRequest = useRef(submittedRequest);
  useLayoutEffect(() => {
    if (!isActive || submittedRequest === undefined || submittedRequest === observedRequest.current) return;
    observedRequest.current = submittedRequest;
    // A new Home query has the old fresh-page defaults; a modal, fold or Back is not a new query.
    setFilter({}); setSort('depart'); setTransferSort('default'); setExpandedTrainIndex(null);
    resultScroll.current?.scrollTo({ top: 0 });
  }, [isActive, submittedRequest]);

  const ownsSurface = useCallback(() => {
    const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1), current = useRailwayStore.getState();
    return mounted.current && isActive && liveKey.current === location.key && top?.activityId === activityId
      && current.from === from && current.to === to && current.date === date;
  }, [activityId, date, from, to, isActive, location.key]);

  // 页面进入/核心查询条件变化时执行查询
  useEffect(() => {
    if (!isActive) return;
    if (activeTab === 'transfer') {
      executeTransferQuery();
      return;
    }
    executeQuery();
  }, [isActive, activeTab, from, to, date, executeQuery, executeTransferQuery]);

  // 生成日期横滑列表（从今天开始往后15天，选中日期用 state.date 匹配）
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const dates = useMemo(() => {
    const today = TimeService.getDate();
    today.setHours(0, 0, 0, 0);
    const dayNames = [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat];
    return Array.from({ length: 15 }, (_, i) => {
      const d = TimeService.fromTimestamp(today.getTime());
      d.setDate(d.getDate() + i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        label: i === 0 ? s.home_date_today : dayNames[d.getDay()],
        display: `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
        isoDate,
        active: isoDate === date,
      };
    });
  }, [date, s]);

  // 自动滚动到选中日期
  useEffect(() => {
    const container = dateScrollRef.current;
    if (!container) return;
    const activeIdx = dates.findIndex(d => d.active);
    if (activeIdx < 0) return;
    const children = container.children;
    if (activeIdx >= children.length) return;
    const child = children[activeIdx] as HTMLElement;
    const scrollLeft = child.offsetLeft - container.clientWidth / 2 + child.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  }, [dates]);

  const handleDateSelect = (isoDate: string) => {
    if (!ownsSurface() || modalOpen) return;
    setDate(isoDate);
    setExpandedTrainIndex(null);
  };



  const dateBinding = (value: string) => searchParams.get('tab') === 'transfer'
    ? bindTap({ kind: 'action', id: 'query.date.transfer.input' }, { params: { value }, onTrigger: () => handleDateSelect(value) })
    : searchParams.get('tab') === 'direct'
      ? bindTap({ kind: 'action', id: 'query.date.direct.input' }, { params: { value }, onTrigger: () => handleDateSelect(value) })
      : bindTap({ kind: 'action', id: 'query.date.base.input' }, { params: { value }, onTrigger: () => handleDateSelect(value) });

  // 排序/筛选在前端内存中执行，避免触发网络查询
  const filteredTrains = useMemo(
    () => applyFilterAndSort(directTrains, filter, sort),
    [directTrains, filter, sort],
  );

  const trains = activeTab === 'direct' ? filteredTrains : [];

  const directIndexBySource = useMemo(() => new Map(directTrains.map((train, index) => [train, index])), [directTrains]);

  // 中转方案排序
  const sortedPlans = useMemo(() => {
    if (activeTab !== 'transfer') return [];
    const plans = [...transferPlans];
    if (transferSort === 'duration') {
      plans.sort((a, b) => parseDurationMinutes(a.totalDuration) - parseDurationMinutes(b.totalDuration));
    } else if (transferSort === 'depart') {
      plans.sort((a, b) => a.leg1.departTime.localeCompare(b.leg1.departTime));
    }
    return plans;
  }, [activeTab, transferPlans, transferSort]);

  // 动态生成出发站/到达站选项（从查询结果中提取唯一站名）
  const fromStationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of directTrains) set.add(t.fromStation);
    return Array.from(set);
  }, [directTrains]);

  const toStationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of directTrains) set.add(t.toStation);
    return Array.from(set);
  }, [directTrains]);

  // 站点快捷标签 = 所有出发站 + 所有到达站（不重复），确保出发站在前
  const stationTags = useMemo(() => {
    const fromSet = new Set<string>();
    const toSet = new Set<string>();
    for (const t of directTrains) {
      fromSet.add(t.fromStation);
      toSet.add(t.toStation);
    }
    // 移除已在 fromSet 中的 toStation，避免重复且保持顺序
    for (const f of fromSet) toSet.delete(f);

    return [...Array.from(fromSet), ...Array.from(toSet)];
  }, [directTrains]);

  const toggleTrainExpand = useCallback((index: number) => {
    expandedQuery.current = queryKey;
    setExpandedTrainIndex(prev => (prev === index ? null : index));
  }, [queryKey]);

  const handleSeatSelect = useCallback((train: TrainInfo, seatType: string, directIndex: number) => {
    const current = useRailwayStore.getState();
    if (!ownsSurface() || modalOpen || activeTab !== 'direct' || current._temp.queryLoading || current.directTrains[directIndex] !== train) return;
    setSelectedTrain({
      trainNo: train.trainNo,
      seatType,
      trainIndex: directIndex,
      passengerIds: [],
    });
    go('trainDetail.book', { idx: directIndex, seat: seatType });
  // The callback identity is part of TrainCard memo ownership, including history/modal changes.
  }, [setSelectedTrain, go, ownsSurface, modalOpen, activeTab]);

  // NOTE: expandedTrainIndex reset is batched inline with setFilter / setSort / setTab
  // to avoid the double-render that useEffect would cause.

  // 筛选面板
  const openFilterPanel = () => { if (!ownsSurface() || modalOpen) return; dialogOpener.current = document.activeElement as HTMLElement | null; go('query.filter.open'); };
  const confirmFilter = (f: TrainFilter) => {
    if (!ownsSurface() || !showFilterPanel) return false;
    setFilter(f);
    setExpandedTrainIndex(null);
    back(); return true;
  };

  // 高级筛选激活数
  const advancedCount = getAdvancedFilterCount(filter);

  return (
    <div className="railway-query-page relative h-full bg-app-bg flex flex-col overflow-hidden" data-railway-query-page data-railway-filter={JSON.stringify(filter)} data-railway-sort={sort}>
      <div className="flex flex-col h-full min-h-0" inert={modalOpen || undefined}>
      {/* 顶栏 */}
      <div className="bg-gradient-to-b from-app-primary to-[#5A9BE6] pt-10 pb-1 px-4">
        <div className="flex items-center justify-between mb-1">
          <button {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <button
            className="text-white text-lg font-medium flex items-center gap-1 active:opacity-60"
            {...bindTap('query.swap.open', { params: { tab: activeTab }, beforeTrigger: () => { dialogOpener.current = document.activeElement as HTMLElement | null; } })}
          >
            {from}
            <span className="text-white/80 text-sm">&lt;&gt;</span>
            {to}
          </button>
          {activeTab === 'transfer' ? (
            <span className="text-white text-xs">{s.query_customize_transfer}</span>
          ) : (
            <EllipsisIcon stroke="white" />
          )}
        </div>

        {/* 日期横滑 + 固定日历图标 */}
        <div className="flex items-center pb-1">
          <div ref={dateScrollRef} data-scroll-container={isActive ? "queryDates" : undefined} data-scroll-direction="horizontal" className="flex-1 flex gap-0.5 overflow-x-auto no-scrollbar">
            {dates.map((d) => (
              <button type="button"
                key={d.isoDate} data-query-date={d.isoDate} aria-pressed={d.active}
                className={`flex-shrink-0 w-(--app-query-header-date-item-w) h-(--app-query-header-date-item-h) flex flex-col items-center justify-center rounded-lg cursor-pointer ${d.active ? 'bg-app-surface text-app-primary' : 'text-white/80'}`}
                {...dateBinding(d.isoDate)}
              >
                <div className="text-[10px] leading-tight">{d.label}</div>
                <div className={`text-[11px] font-medium leading-tight ${d.active ? 'text-app-primary' : 'text-white'}`}>{d.display}</div>
              </button>
            ))}
          </div>
          <div
            className="flex-shrink-0 pl-2 pr-1 flex flex-col items-center justify-center text-white/80 cursor-pointer"
            {...bindTap<HTMLDivElement>('home.dateSelect')}
          >
            <IcCalendar size={14} />
            <span className="text-[10px]">{s.query_calendar_label}</span>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div ref={resultScroll} className="flex-1 min-h-0 overflow-y-auto no-scrollbar" data-scroll-container={isActive ? "main" : undefined} data-scroll-direction="vertical">
        {/* 直达/中转 tab — 随内容滚动隐藏 */}
        <div className="bg-app-surface flex border-b border-gray-100">
          <button
            className={`flex-1 py-2.5 text-center flex flex-col items-center justify-center relative ${activeTab === 'direct' ? 'text-app-primary' : 'text-gray-500'}`}
            {...bindTap('query.tab.direct', { beforeTrigger: () => setExpandedTrainIndex(null) })}
          >
            <div className="flex items-center gap-1">
              <DirectRouteIcon />
              <span className="text-sm font-medium">{s.query_tab_direct}</span>
            </div>
            {activeTab === 'direct' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-app-primary rounded-full" />}
          </button>
          <button
            className={`flex-1 py-2.5 text-center flex flex-col items-center justify-center relative ${activeTab === 'transfer' ? 'text-app-primary' : 'text-gray-500'}`}
            {...bindTap('query.tab.transfer', { beforeTrigger: () => setExpandedTrainIndex(null) })}
          >
            <div className="flex items-center gap-1">
              <IcSwapAlt size={16} />
              <span className="text-sm font-medium">{s.query_tab_transfer}</span>
            </div>
            {activeTab === 'transfer' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-app-primary rounded-full" />}
          </button>
        </div>

        {/* 直达 tab: 筛选条 + 站点标签 — 滚动到顶部后吸顶固定 */}
        {activeTab === 'direct' && (
          <div className="sticky top-0 z-20">
            <div className="bg-app-surface px-4 py-1 flex items-center gap-3 text-xs text-gray-500 overflow-x-auto no-scrollbar">
              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" className="w-3 h-3 accent-app-primary" checked={!!filter.onlyHighSpeed} onChange={e => { setFilter(f => ({ ...f, onlyHighSpeed: e.target.checked, onlyRegular: false })); setExpandedTrainIndex(null); }} />
                <span>{s.filter_only_high_speed}</span>
              </label>
              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" className="w-3 h-3 accent-app-primary" checked={!!filter.onlyRegular} onChange={e => { setFilter(f => ({ ...f, onlyRegular: e.target.checked, onlyHighSpeed: false })); setExpandedTrainIndex(null); }} />
                <span>{s.filter_only_regular}</span>
              </label>
              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" className="w-3 h-3 accent-app-primary" checked={!!filter.onlyAvailable} onChange={e => { setFilter(f => ({ ...f, onlyAvailable: e.target.checked })); setExpandedTrainIndex(null); }} />
                <span>{s.filter_only_available}</span>
              </label>
              {/* 筛选按钮 */}
              <button
                className={`flex items-center gap-0.5 whitespace-nowrap ml-auto ${advancedCount > 0 ? 'text-app-primary' : 'text-gray-500'}`}
                {...bindTap('query.filter.open', { onTrigger: openFilterPanel })}
              >
                <IcFilter size={12} />
                <span>{s.filter_btn}</span>
                {advancedCount > 0 && (
                  <span className="bg-app-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{advancedCount}</span>
                )}
              </button>
            </div>
            {/* 站点快捷标签 */}
            <div className="bg-app-surface px-4 py-1 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-100">
              {stationTags.map(stn => (
                <button
                  key={stn}
                  className={`flex-shrink-0 text-xs px-3 py-1 rounded border ${filter.stationFilter === stn ? 'bg-app-primary text-white border-app-primary' : 'text-gray-500 border-app-border bg-[#F8F9FA]'}`}
                  onClick={() => { setFilter(f => ({ ...f, stationFilter: f.stationFilter === stn ? undefined : stn })); setExpandedTrainIndex(null); }}
                >
                  {stn}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading 状态 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <IcLoader size={32} className="text-app-primary animate-spin mb-3" />
            <span className="text-gray-500 text-sm">{s.query_loading}</span>
          </div>
        )}

        {/* Error 状态 */}
        {error && !loading && (
          <div className="mx-3 mt-4 bg-app-surface rounded-xl p-4 text-center flex flex-col items-center gap-3">
            <span className="text-red-500 text-sm">{s.query_error_prefix}{error === 'NETWORK_UNAVAILABLE' ? s.query_network_unavailable : error}</span>
            <button
              type="button"
              data-railway-query-retry
              className="rounded-full bg-app-primary px-4 py-1.5 text-sm text-white"
              onClick={() => { void (activeTab === 'transfer' ? executeTransferQuery() : executeQuery()); }}
            >
              {s.query_retry}
            </button>
          </div>
        )}

        {activeTab === 'direct' ? (
          <>
            {/* 空结果状态 */}
            {!loading && trains.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <span className="text-gray-500 text-sm leading-6">
                  {s.query_empty_direct.replace('{from}', from).replace('{to}', to)}
                </span>
                <span className="mt-2 text-gray-400 text-sm leading-6">
                  {s.query_empty_direct_hint}
                </span>
              </div>
            )}

            {/* 列车列表 */}
            {trains.map((train, i) => {
              const directIndex = directIndexBySource.get(train);
              if (directIndex === undefined) return null;
              return (
              <TrainCard
                key={`${train.trainNo}-${train.departTime}-${train.fromStation}-${train.toStation}`}
                train={train}
                index={i}
                directIndex={directIndex}
                date={date}
                isExpanded={expandedTrainIndex === i && expandedQuery.current === queryKey}
                onToggle={toggleTrainExpand}
                onSelectSeat={handleSeatSelect}
                bindTap={bindTap} bookingEnabled={isActive && !loading && !modalOpen}
              />
              );
            })}

            {/* 温馨提示 */}
            {!loading && trains.length > 0 && (
              <div className="mx-3 mt-2 mb-4 bg-app-surface rounded-2xl p-4 shadow-sm">
                <div className="text-gray-800 font-medium mb-2">{s.warm_tip_label}</div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>1.显示的票价均为折扣后的最低执行票价，点击 <span className="text-app-primary">查看公布票价</span>。</div>
                  <div>2.如因运力原因或其他不可控因素导致列车调度调整时，当前车型可能会发生变动。</div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* 中转方案列表 */
          <>
            {/* 空结果状态 */}
            {!loading && sortedPlans.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-16">
                <span className="text-gray-400 text-sm">{s.query_empty_transfer}</span>
              </div>
            )}

            {sortedPlans.map((plan, i) => (
              <div key={i} className="bg-app-surface mx-3 mt-2 rounded-xl p-4 shadow-sm">
                {/* 第一段 */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-2xl font-bold">{plan.leg1.departTime}</div>
                    <div className="text-xs text-gray-500">{plan.leg1.fromStation}</div>
                  </div>
                  <div className="flex-1 px-2 text-center relative">
                    <div className="text-[10px] text-green-600 mb-1">{s.transfer_total_prefix}{plan.totalDuration}</div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px] text-gray-400">{plan.leg1.arriveTime}{s.transfer_arrive_suffix}</span>
                      <div className="h-px flex-1 bg-gray-200 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-app-surface border border-gray-300 rounded-full px-2 py-0.5 text-[10px]">{plan.transferStation}</div>
                      </div>
                      <span className="text-[10px] text-gray-400">{plan.leg2.departTime}{s.transfer_depart_suffix}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                      <span>{plan.leg1.trainNo} {plan.leg1.quiet ? '静' : ''}</span>
                      <span className="text-gray-300">{s.transfer_seat_change}</span>
                      <span>{plan.leg2.trainNo} {plan.leg2.quiet ? '静' : ''}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{plan.leg2.arriveTime}</div>
                    <div className="text-xs text-gray-500">{plan.leg2.toStation}</div>
                  </div>
                </div>
                {/* 座位信息 */}
                <div className="mt-3 space-y-1">
                  {[1, 2].map(legNum => {
                    const leg = legNum === 1 ? plan.leg1 : plan.leg2;
                    return (
                      <div key={legNum} className="flex gap-3 text-xs">
                        <span className="text-gray-500 w-6">{legNum}{s.transfer_leg_suffix}</span>
                        {leg.seats.map(seat => (
                          <span key={seat.type}>
                            {seat.type}{' '}
                            {seat.count === 0 ? <span className="text-gray-400">{s.seat_none}</span> :
                              <span className="text-green-600">{seat.count > 99 ? s.seat_available_short : `${seat.count}${s.seat_count_suffix}`}</span>}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )
        }
      </div>

      {/* 底部工具栏 */}
      <div className="bg-app-surface border-t border-gray-100 flex shrink-0 pb-3" data-navigation-bar-foreground="dark">
        {activeTab === 'direct' ? (
          <>
            {([
              { label: s.filter_btn, icon: IcFilter, asc: 'default' as SortMode, desc: 'default' as SortMode, ascLabel: s.filter_btn, descLabel: s.filter_btn, isFilter: true },
              { label: s.sort_duration_asc, icon: IcClock, asc: 'duration' as SortMode, desc: 'duration_desc' as SortMode, ascLabel: s.sort_duration_asc, descLabel: s.sort_duration_desc, isFilter: false },
              { label: s.sort_depart_asc, icon: IcCalendar, asc: 'depart' as SortMode, desc: 'depart_desc' as SortMode, ascLabel: s.sort_depart_asc, descLabel: s.sort_depart_desc, isFilter: false },
              { label: s.sort_price_asc, icon: IcCoins, asc: 'price' as SortMode, desc: 'price_desc' as SortMode, ascLabel: s.sort_price_asc, descLabel: s.sort_price_desc, isFilter: false },
              { label: s.sort_waitlist, icon: IcClipboard, asc: 'default' as SortMode, desc: 'default' as SortMode, ascLabel: s.sort_waitlist, descLabel: s.sort_waitlist, isFilter: false },
            ]).map(item => {
              const isAsc = sort === item.asc && item.asc !== 'default';
              const isDesc = sort === item.desc && item.desc !== 'default';
              const active = isAsc || isDesc;
              const displayLabel = isDesc ? item.descLabel : item.ascLabel;
              return (
                <button key={item.ascLabel} data-query-sort={item.asc} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 relative ${active ? 'text-app-primary' : 'text-gray-500'}`}
                  {...(item.isFilter ? bindTap('query.filter.open', { onTrigger: openFilterPanel }) : { onClick: () => {
                    if (item.asc === 'default') return;
                    if (isAsc) {
                      setSort(item.desc);
                    } else if (isDesc) {
                      setSort(item.asc);
                    } else {
                      setSort(item.asc);
                    }
                    setExpandedTrainIndex(null);
                  } })}>
                  {item.icon && <item.icon size={16} />}
                  <span className="text-[10px]">{displayLabel}</span>
                  {/* 筛选按钮上显示激活数 */}
                  {item.isFilter && advancedCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FF4D4F] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">{advancedCount}</span>
                  )}
                </button>
              );
            })}
          </>
        ) : (
          <>
            {([
              { label: s.filter_btn, icon: IcFilter, mode: 'default' as TransferSortMode },
              { label: s.sort_duration_asc, icon: IcClock, mode: 'duration' as TransferSortMode },
              { label: s.sort_depart_asc, icon: IcCalendar, mode: 'depart' as TransferSortMode },
              { label: s.sort_show_price, icon: null, mode: 'default' as TransferSortMode },
            ]).map(item => (
              <button key={item.label}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 ${transferSort === item.mode && item.mode !== 'default' ? 'text-app-primary' : 'text-gray-500'}`}
                onClick={() => item.mode !== 'default' && setTransferSort(item.mode)}
              >
                {item.icon && <item.icon size={16} />}
                <span className="text-[10px]">{item.label}</span>
              </button>
            ))}
          </>
        )}
      </div>

      </div>
      {/* 筛选面板 overlay */}
      {showFilterPanel && (
        <FilterPanel
          key={queryKey} filter={filter} returnFocus={dialogOpener}
          onConfirm={confirmFilter}
          fromStationOptions={fromStationOptions}
          toStationOptions={toStationOptions}
        />
      )}

      {showSwapDialog && <QuerySwapDialog returnFocus={dialogOpener} onConfirm={() => {
        if (!ownsSurface()) return false;
        back(); swapStations(); setExpandedTrainIndex(null); return true;
      }} />}

    </div>
  );
};
