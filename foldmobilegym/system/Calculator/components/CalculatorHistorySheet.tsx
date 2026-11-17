import React, { useEffect, useMemo, useRef } from 'react';
import * as TimeService from '../../../os/TimeService';
import { useLocation } from 'react-router-dom';
import { useActivityContext } from '../../../os/ActivityContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { useCalculatorGestures } from '../hooks/useCalculatorGestures';
import { getCalculationHistoryRows, historyDateKey, historyDateLabel } from '../historyPresentation';
import { parseHistoryDeletionTargets, parseHistorySelection, visibleHistoryRecords, historyEntryId, historyDeletionTargets } from '../historyEditing';
import { useCalculatorStore } from '../state';
import { IcCheck, IcClose, IcEdit, IcTrash } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { CalculatorHistoryDeleteDialog } from './CalculatorHistoryDeleteDialog';
import { trapHistoryFocus } from './historyFocus';

export const CalculatorHistorySheet: React.FC = () => {
  const records = useCalculatorStore(state => state.calculations);
  const editor = useCalculatorStore(state => state.expressionEditor);
  const hidden = useCalculatorStore(state => state.hiddenHistoryRecordIds);
  const rows = useMemo(() => getCalculationHistoryRows(records, hidden,editor?.records), [records, hidden,editor?.records]);
  const visible = useMemo(() => visibleHistoryRecords(records, hidden,editor?.records), [records, hidden,editor?.records]);
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const editing = query.get('history') === 'edit';
  const confirming = query.get('dialog') === 'deleteHistory';
  const selected = parseHistorySelection(query.get('selection'), visible);
  const selectedSet = new Set(selected);
  const targets = useMemo(() => parseHistoryDeletionTargets(new URLSearchParams(location.search).get('targets')), [location.search]);
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, bindTap } = useCalculatorGestures();
  const { taskId } = useActivityContext();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dateLabel = (timestamp: number | undefined) => {
    if(timestamp===undefined)return s.history_undated;
    const date=TimeService.fromTimestamp(timestamp);
    return historyDateLabel(date, TimeService.fromTimestamp(TimeService.now()), s.history_date_locale, s.history_undated);
  };
  const dateKey = (timestamp: number | undefined) => timestamp === undefined ? 'undated' : historyDateKey(TimeService.fromTimestamp(timestamp));
  const selectedTargets = visible.filter(record => selectedSet.has(historyEntryId(record)));

  useEffect(() => {
    const previous = document.activeElement;
    const ownsFocus = () => {
      const os = window.__OS__?.getState();
      return os?.activeTaskId === taskId && !os.isLauncherVisible && !os.isRecentsVisible;
    };
    if (ownsFocus()) closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (ownsFocus() && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [taskId]);

  return <div className="calculator-history-layer" data-calculator-history>
    <button type="button" className="calculator-history-backdrop" aria-label={s.history_close}
      tabIndex={-1} data-calculator-history-backdrop {...bindBack()} />
    <section className="calculator-history-sheet" role="dialog" aria-modal={!confirming || undefined} aria-label={s.history_title}
      inert={confirming} aria-hidden={confirming || undefined} data-calculator-history-editor={editing} data-calculator-expression-history={!!editor} onKeyDown={trapHistoryFocus}>
      <header className="calculator-history-header">
        <h2>{editing ? s.history_selected.replace('{count}', String(selected.length)) : s.history_title}</h2>
        <div className="calculator-history-tools">
          {editing ? <>
            <button type="button" className="calculator-history-selectall" data-calculator-history-selectall disabled={!rows.length}
              {...bindTap('calculator.history.selection.change', { params: { selection: selected.length === rows.length ? '' : rows.map(row => row.id).join(',') } })}>
              {selected.length === rows.length && rows.length ? s.history_unselect_all : s.history_select_all}
            </button>
            <button type="button" disabled={!selected.length} aria-label={s.history_delete_selected}
              {...bindTap('calculator.history.delete.open', { params: { targets: JSON.stringify(historyDeletionTargets(selectedTargets)) } })}><IcTrash size={19} aria-hidden="true" /></button>
          </> : <>
            <button type="button" disabled={!rows.length} aria-label={s.history_edit} {...bindTap('calculator.history.edit.open')}><IcEdit size={19} aria-hidden="true" /></button>
            <button type="button" disabled={!rows.length} aria-label={s.history_clear} {...bindTap('calculator.history.clear.open', { params: { targets: JSON.stringify(historyDeletionTargets(visible)) } })}><IcTrash size={19} aria-hidden="true" /></button>
          </>}
          <button type="button" ref={closeRef} aria-label={editing ? s.history_done : s.history_close} data-calculator-history-close {...bindBack()}>
            {editing ? <IcCheck size={20} aria-hidden="true" /> : <IcClose size={20} aria-hidden="true" />}
          </button>
        </div>
      </header>
      <div className="calculator-history-list" data-scroll-container="history" data-scroll-direction="vertical" tabIndex={0} aria-label={s.history_title}>
        {rows.length === 0 ? <p className="calculator-history-empty" data-calculator-history-empty>{s.history_empty}</p>
          : <ol>{rows.map((row,index) => <React.Fragment key={row.id}>{(index===0||dateKey(rows[index-1].timestamp)!==dateKey(row.timestamp))&&<li className="calculator-history-date" data-history-date>{dateLabel(row.timestamp)}</li>}<li data-calculator-history-id={row.id}>
            {editing ? <button type="button" className="calculator-history-record" role="checkbox" aria-checked={selectedSet.has(row.id)} data-calculator-history-select={row.id}
              {...bindTap('calculator.history.selection.change', { params: { selection: (selectedSet.has(row.id) ? selected.filter(id => id !== row.id) : [...selected, row.id]).join(',') } })}>
              <span className="calculator-history-checkbox" aria-hidden="true">{selectedSet.has(row.id) ? <IcCheck size={16} /> : null}</span>
              <span><span data-history-expression>{row.expression}</span><strong><span aria-hidden="true">=</span><span data-history-result>{row.result}</span></strong></span>
            </button> : <><div data-history-expression>{row.expression}</div><strong><span aria-hidden="true">=</span><span data-history-result>{row.result}</span></strong></>}
          </li></React.Fragment>)}</ol>}
      </div>
    </section>
    {confirming && <CalculatorHistoryDeleteDialog key={location.key} targets={targets} editing={editing} fallbackFocus={closeRef} />}
  </div>;
};
