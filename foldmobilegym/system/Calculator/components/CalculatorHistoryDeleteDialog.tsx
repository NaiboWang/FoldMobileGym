import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { TaskManager } from '../../../os/TaskManager';
import { useActivityContext } from '../../../os/ActivityContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { historyDeletionStillCurrent } from '../historyEditing';
import { ownsHistoryDeletion } from '../historyOwnership';
import { useCalculatorStore } from '../state';
import { useCalculatorGestures } from '../hooks/useCalculatorGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import type { HistoryTarget } from '../types';
import { trapHistoryFocus } from './historyFocus';

export const CalculatorHistoryDeleteDialog: React.FC<{
  targets: readonly HistoryTarget[];
  editing: boolean;
  fallbackFocus: React.RefObject<HTMLButtonElement | null>;
}> = ({ targets, editing, fallbackFocus }) => {
  const records = useCalculatorStore(state => state.calculations);
  const editor = useCalculatorStore(state => state.expressionEditor);
  const hidden = useCalculatorStore(state => state.hiddenHistoryRecordIds);
  const { bindBack, bindTap, back } = useCalculatorGestures();
  const { taskId, activityId } = useActivityContext();
  const location = useLocation();
  const href = `${location.pathname}${location.search}`;
  const s = useAppStrings(strings, stringsEn);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(false);
  const stillCurrent = historyDeletionStillCurrent(records, hidden, targets, editor?.records);
  const isOwner = useCallback((mounted: boolean) => {
    const multi = window.__FOLDAGENT__?.getState().multi_window;
    const floating = multi?.mode === 'floating' && multi.floating && !multi.floating.minimized ? multi.floating.task_id : null;
    return ownsHistoryDeletion({ alive: mounted, taskId, activityId, href }, TaskManager.getState(),
      window.__OS__?.getAppRoute('calculator')?.path, floating);
  }, [taskId, activityId, href]);
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const previous = document.activeElement;
    const fallback = fallbackFocus.current;
    if (isOwner(true)) cancelRef.current?.focus({ preventScroll: true });
    return () => {
      const os = TaskManager.getState();
      if (os.activeTaskId !== taskId || os.isRecentsVisible
        || os.tasks.find(task => task.taskId === taskId)?.stack.at(-1)?.activityId !== activityId) return;
      if (previous instanceof HTMLButtonElement && previous.isConnected && !previous.disabled) previous.focus({ preventScroll: true });
      else if (fallback?.isConnected) fallback.focus({ preventScroll: true });
    };
  }, [taskId, activityId, fallbackFocus, isOwner]);
  const submit = () => {
    if (!isOwner(alive.current)) return;
    if (useCalculatorStore.getState().deleteHistoryRecords(targets)) back();
  };
  const submitProps = editing
    ? bindTap({ kind: 'action', id: 'calculator.history.delete.submit' }, { onTrigger: submit })
    : bindTap({ kind: 'action', id: 'calculator.history.clear.submit' }, { onTrigger: submit });

  return <div className="calculator-history-confirmation" data-calculator-history-confirmation>
    <button type="button" className="calculator-history-backdrop" aria-label={s.history_cancel} tabIndex={-1} {...bindBack()} />
    <section role="alertdialog" aria-modal="true" aria-label={s.history_delete_title}
      className="calculator-history-confirm-box" onKeyDown={trapHistoryFocus}>
      <h3>{s.history_delete_title}</h3>
      <p data-scroll-container="historyDialog" data-scroll-direction="vertical">{stillCurrent ? s.history_delete_count.replace('{count}', String(targets.length)) : s.history_request_stale}</p>
      <div className="calculator-history-confirm-buttons">
        <button type="button" ref={cancelRef} data-calculator-history-delete-cancel {...bindBack()}>{s.history_cancel}</button>
        <button type="button" disabled={!stillCurrent} data-calculator-history-delete-confirm {...submitProps}>{s.history_delete}</button>
      </div>
    </section>
  </div>;
};
