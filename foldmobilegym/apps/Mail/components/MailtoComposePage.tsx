import React from 'react';
import { useActivityContext } from '@/os/ActivityContext';
import { TaskManager } from '@/os/TaskManager';
import { useAppNavigationHandler } from '@/os/hooks/useAppNavigationHandler';
import { useTriggerGestures } from '@/os/hooks/useTriggerGestures';
import { useAppStrings } from '@/os/useAppStrings';
import { normalizeEmailAddress } from '@/os/utils/emailAddress';
import { useMailStore } from '../state';
import { mailtoEditor } from '../mailtoDrafts';
import { useMailSurfaceOwner } from '../hooks/useMailSurfaceOwner';
import { IcMailBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

/** A borrowed Activity; it must not change a warm Mail reader or composer. */
export function MailtoComposePage() {
  const { activityId, taskId } = useActivityContext();
  const getIntent = React.useCallback(() => TaskManager.getState().tasks
    .find(task => task.taskId === taskId)?.stack.find(activity => activity.activityId === activityId)?.intent ?? null,
  [activityId, taskId]);
  const intent = React.useSyncExternalStore(TaskManager.subscribe, getIntent, getIntent);
  const recipient = intent?.action === 'ACTION_VIEW' && intent.scheme === 'mailto'
    ? normalizeEmailAddress(intent.data?.address) ?? '' : '';
  const state = useMailStore(), view = mailtoEditor(state, recipient);
  const owner = useMailSurfaceOwner(), { bindTap } = useTriggerGestures();
  const s = useAppStrings(strings, stringsEn), saving = React.useRef(false);
  useAppNavigationHandler('mail', { onBack: () => false });
  const owns = () => owner() && !!intent && getIntent() === intent;
  const canAct = () => owns() && view.available && mailtoEditor(useMailStore.getState(), recipient).key === view.key;
  const change = (patch: Parameters<typeof state.updateMailto>[2]) => { if (canAct()) state.updateMailto(recipient, view.key, patch); };
  const save = () => {
    if (saving.current || !canAct()) return;
    saving.current = true;
    if (state.saveMailto(recipient, view.key) && owns()) {
      window.__OS__?.keyboard.hide();
      window.__OS__?.finishActivity();
    } else saving.current = false;
  };
  const back = { ...bindTap<HTMLButtonElement>('system.back'), 'data-trigger-type': 'back' as const };
  return <div className="mroot" data-mailto-recipient={recipient}><article className="mcompose show" style={{ height: '100%' }}>
    <header className="compose-head">
      <button type="button" aria-label={s.mailto_back} style={{ order: 0 }} {...back}
        onClick={event => { if (owner()) back.onClick?.(event); }}><IcMailBack size={22} /></button>
      <h2>{s.compose_title}</h2>
    </header>
    <p className="mail-local-only">{s.compose_local_only}</p>
    {!view.available && <p role="status">{recipient ? s.mailto_source_changed : s.mailto_address_missing}</p>}
    <div className="compose-form" data-scroll-container="compose" data-scroll-direction="vertical">
      <label className="mail-compose-recipient"><span>{s.recipient}</span>
        <input aria-label={s.recipient} value={view.input.to} readOnly={!view.available}
          data-action="mail.mailto.to.input" data-action-type="input" data-action-params={JSON.stringify({ value: view.input.to })}
          onChange={event => change({ to: event.target.value })} /></label>
      <input aria-label={s.subject} placeholder={s.subject} value={view.input.subject} readOnly={!view.available}
        data-action="mail.mailto.subject.input" data-action-type="input" data-action-params={JSON.stringify({ value: view.input.subject })}
        onChange={event => change({ subject: event.target.value })} />
      <textarea aria-label={s.body} placeholder={s.body} value={view.input.body} readOnly={!view.available}
        data-action="mail.mailto.body.input" data-action-type="input" data-action-params={JSON.stringify({ value: view.input.body })}
        onChange={event => change({ body: event.target.value })} />
    </div>
    <button type="button" className="draft-save" data-keep-keyboard onPointerDown={event => event.preventDefault()}
      disabled={!view.available || !normalizeEmailAddress(view.input.to) || !view.input.subject.trim() || !view.input.body.trim()}
      {...bindTap({ kind: 'action', id: 'mail.mailto.save.submit' }, { onTrigger: save })}>{s.save_draft}</button>
  </article></div>;
}
