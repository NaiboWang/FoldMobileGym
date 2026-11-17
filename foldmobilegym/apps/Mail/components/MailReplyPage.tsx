import React from 'react';
import { useTriggerGestures } from '@/os/hooks/useTriggerGestures';
import { useAppStrings } from '@/os/useAppStrings';
import { useMailStore } from '../state';
import { canUseReplySurface, replyEditor } from '../replyDrafts';
import { useMailSurfaceOwner } from '../hooks/useMailSurfaceOwner';
import { useMailReplyVisibility } from '../hooks/useMailReplyVisibility';
import { useMailNavigate } from '../navigation';
import { IcMailBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function MailReplyPage({ messageId }: { messageId: string }) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const state = useMailStore(), view = replyEditor(state, messageId);
  const owner = useMailSurfaceOwner(), { back } = useMailNavigate(), { bindTap } = useTriggerGestures();
  const s = useAppStrings(strings, stringsEn), claimed = React.useRef(false);
  React.useLayoutEffect(() => { claimed.current = false; }, [view.key, messageId]);
  const ownsSurface = () => canUseReplySurface(owner(), window.__OS__?.getState());
  useMailReplyVisibility(scrollerRef, messageId, ownsSurface);
  const bindBack = () => ({ ...bindTap<HTMLButtonElement>('system.back'), 'data-trigger-type': 'back' as const });
  const closeBinding = bindBack();
  const canAct = () => {
    const live = useMailStore.getState(), actual = replyEditor(live, messageId);
    return ownsSurface() && view.available && actual.available && actual.key === view.key
      && actual.source === view.source && actual.draft === view.draft;
  };
  const update = (body: string) => { if (canAct()) state.updateReply(messageId, view.key, body); };
  const save = () => {
    if (claimed.current || !canAct()) return;
    claimed.current = true;
    if (state.saveReply(messageId, view.key)) { window.__OS__?.keyboard.hide(); back(); }
    else claimed.current = false;
  };
  return <div className="mroot"><article className="mail-reply" data-mail-reply-source={messageId}>
    <header className="compose-head"><button type="button" aria-label={s.reply_back} {...closeBinding}
      onClick={event => { if (ownsSurface()) closeBinding.onClick?.(event); }}><IcMailBack size={22} /></button><h2>{s.reply_title}</h2></header>
    <p className="mail-local-only" data-hide-on-keyboard>{s.compose_local_only}</p>
    {!view.available && <p role="status">{view.status === 'address' ? s.reply_address_missing : view.status === 'missing' ? s.message_unavailable : s.reply_source_changed}</p>}
    <div ref={scrollerRef} className="mail-reply-scroll" data-scroll-container="reply" data-scroll-direction="vertical">
      <section className="mail-reply-context" aria-label={s.reply_source}>
        <strong>{view.source?.subject ?? view.input.subject}</strong>
        <p>{s.recipient}: <span data-mail-reply-to>{view.input.to || s.sender_address_unavailable}</span></p>
        <p>{s.subject}: {view.input.subject}</p>
        <small>{view.source?.date}</small>
        <p className="mail-reply-original" data-os-clipboard="true">{view.source?.body}</p>
      </section>
      <label>{s.body}<textarea data-benchmark-field="mail-reply-body" aria-label={s.body} data-keyboard-scroll="none"
        data-action="mail.reply.body.input" data-action-type="input" data-action-params={JSON.stringify({ value: view.input.body })}
        value={view.input.body} readOnly={!view.available} onChange={event => update(event.target.value)} /></label>
      {!!view.input.attachments?.length && <section className="mail-attachments" aria-label={s.attachments}>
        {view.input.attachments.map(reference => <p key={reference.id} data-mail-reply-attachment={reference.id}>{reference.path.split('/').at(-1)}</p>)}
        <small>{s.attachment_reference_note}</small>
      </section>}
    </div>
    <button type="button" className="draft-save" data-keep-keyboard onPointerDown={event => event.preventDefault()}
      disabled={!view.available || !view.input.body.trim()} {...bindTap({ kind: 'action', id: 'mail.reply.save' }, { onTrigger: save })}>{s.save_draft}</button>
  </article></div>;
}
