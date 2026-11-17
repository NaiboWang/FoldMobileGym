import React from "react";
import "./mail-adaptive.css";
import {
  Archive,
  CheckCircle2,
  Inbox,
  MailOpen,
  MoreVertical,
  PenLine,
  Save,
} from "lucide-react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useAppNavigationHandler } from "../../os/hooks/useAppNavigationHandler";
import { useAppStrings } from "../../os/useAppStrings";
import { hasMailInput, useMailStore } from "./state";
import { IcLauncher, IcAttachment, IcRemoveAttachment, IcMailSearch, IcMailBack, IcMailStar, IcMailMenu, IcMailDrafts, IcMailAll } from "./res/icons";
import { MailFolderDrawer } from './components/MailFolderDrawer';
import { mailFolderFromPath, mailFolderRows } from './folders';
import { MailSearchPanel } from "./components/MailSearchPanel";
import { MailReplyPage } from './components/MailReplyPage';
import { canUseReplySurface, replyAddress } from './replyDrafts';
import { useMailNavigate } from "./navigation";
import { mailSearchRoute, mailReplyId } from "./searchRouting";
import { useMailSurfaceOwner } from "./hooks/useMailSurfaceOwner";
import type { Draft, Message } from "./types";
import { useMailAttachmentPicker } from "./hooks/useMailAttachmentPicker";
import { useTriggerGestures } from "../../os/hooks/useTriggerGestures";
import * as FileSystem from "../../os/FileSystemService";
import { TaskManager } from '../../os/TaskManager';
import { MailtoComposePage } from './components/MailtoComposePage';
import { MailActivityNavigation } from './components/MailActivityNavigation';
import { MailAttachmentMetadata } from './components/MailAttachmentMetadata';
import { strings } from "./res/strings";
import { stringsEn } from "./res/strings.en";



const MailInbox: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { go, back, closeMessageMenu } = useMailNavigate(), location = useLocation(), surfaceOwner = useMailSurfaceOwner();
  const route = mailSearchRoute(location.pathname), inSearch = route.kind !== 'inbox';
  const folderPath = location.pathname.startsWith('/folder/'), folder = mailFolderFromPath(location.pathname);
  const inFolder = folderPath && folder !== null;
  const drawerOpen = !inSearch && new URLSearchParams(location.search).get('drawer') === 'open';
  const messageMenuOpen = !drawerOpen && new URLSearchParams(location.search).get('menu') === 'message';
  const isCurrent = (queryOnly = false, allowMenu = false) => {
    const os = window.__OS__?.getState();
    return !drawerOpen && (!messageMenuOpen || allowMenu) && !os?.isLauncherVisible && !os?.isRecentsVisible && surfaceOwner(queryOnly);
  };
  const messageMenuRef = React.useRef<HTMLElement>(null), messageMenuButton = React.useRef<HTMLButtonElement>(null);
  const latestOwner = React.useRef(surfaceOwner); latestOwner.current = surfaceOwner;
  React.useEffect(() => {
    if (!messageMenuOpen) return;
    const opener = messageMenuButton.current;
    if (latestOwner.current()) messageMenuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    return () => { queueMicrotask(() => {
      if (latestOwner.current() && opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
    }); };
  }, [messageMenuOpen]);
  const folderButton = React.useRef<HTMLButtonElement>(null), wasDrawerOpen = React.useRef(false);
  React.useEffect(() => {
    if (wasDrawerOpen.current && !drawerOpen && latestOwner.current()) folderButton.current?.focus({ preventScroll: true });
    wasDrawerOpen.current = drawerOpen;
  }, [drawerOpen]);
  const replyId = mailReplyId(location.pathname), openingReply = React.useRef<string | null>(null);
  const replyFromDrafts = ['drafts', 'draftSearch', 'folderDrafts'].includes(new URLSearchParams(location.search).get('origin') ?? '');
  React.useEffect(() => { openingReply.current = null; }, [location.key]);
  const openingSearch = React.useRef<string | null>(null);
  React.useEffect(() => { if (openingSearch.current !== location.key) openingSearch.current = null; }, [location.key]);
  const { bindTap } = useTriggerGestures();
  const menuBackBinding = bindTap('system.back');
  const { openPicker, busy: attachmentBusy, error: attachmentError } = useMailAttachmentPicker();
  const removeAttachment = useMailStore(state => state.removeAttachment);
  const messages = useMailStore((state) => state.messages);
  const selectedId = useMailStore((state) => state.selectedId);
  const verifiedIds = useMailStore((state) => state.verifiedIds);
  const starredIds = useMailStore(state => state.starredIds);
  const archivedIds = useMailStore(state => state.archivedIds);
  const unreadIds = useMailStore(state => state.unreadIds);
  const composeOpen = useMailStore((state) => state.composeOpen);
  const draft = useMailStore((state) => state.draftInput);
  const drafts = useMailStore((state) => state.drafts);
  const folderRows = mailFolderRows(folder ?? 'inbox', messages, drafts, starredIds, archivedIds);
  const folderTitle = folder === 'starred' ? s.starred_folder : folder === 'drafts' ? s.drafts : folder === 'all' ? s.all_mail : s.inbox;
  const open = useMailStore((state) => state.open);
  const verify = useMailStore((state) => state.verify);
  const beginCompose = useMailStore((state) => state.beginCompose);
  const closeCompose = useMailStore((state) => state.closeCompose);
  const updateDraft = useMailStore((state) => state.updateDraft);
  const saveDraft = useMailStore((state) => state.saveDraft);
  const openDraft = useMailStore((state) => state.openDraft);
  const openRecovery = useMailStore(state => state.openRecovery), buffers = useMailStore(state => state.editorBuffers);
  const conflicts = Object.entries(buffers).filter(([key]) => key.startsWith('conflict:'));
  const recoveryBlocked = hasMailInput(editingBuffer());
  function editingBuffer() { const current = useMailStore.getState(); return current.editingDraftId ? current.editorBuffers.new : current.draftInput; }
  const editingDraftId = useMailStore((state) => state.editingDraftId);
  const composeEpoch = useMailStore(state => state._temp?.composeEpoch ?? 0);
  const editorOwner = React.useRef<{ session: string; source?: Draft }>({ session: '' });
  const session = composeOpen ? JSON.stringify([editingDraftId, composeEpoch]) : '';
  if (session !== editorOwner.current.session) editorOwner.current = { session, source: editingDraftId ? drafts.find(item => item.id === editingDraftId) : undefined };
  const sourceDraft = editorOwner.current.source;
  const draftExists = !editingDraftId || drafts.some(item => item.id === editingDraftId);
  const draftAvailable = draftExists && (!editingDraftId || drafts.find(item => item.id === editingDraftId) === sourceDraft);
  const message = route.kind === 'message' ? messages.find(item => item.id === route.id) : route.kind === 'inbox' ? messages.find(item => item.id === selectedId) : undefined;
  const searchDraftReady = route.kind === 'draft' && !!route.id && composeOpen && editingDraftId === route.id;
  const showComposer = route.kind === 'inbox' ? composeOpen : searchDraftReady;
  const previousSurface = React.useRef(location.pathname);
  React.useLayoutEffect(() => {
    const previous = previousSurface.current; previousSurface.current = location.pathname;
    // Folder navigation opens its list. Returning from a source-bound reply
    // is the exception: that reader remains the original parent surface.
    if (inFolder && previous !== location.pathname && !previous.startsWith('/reply/')) {
      const current = useMailStore.getState();
      if (current.selectedId || current.composeOpen) current.open(null);
    }
  }, [location.pathname, inFolder]);
  React.useLayoutEffect(() => {
    const current = useMailStore.getState();
    if (replyId !== null) {
      const id = !replyFromDrafts && current.messages.some(item => item.id === replyId) ? replyId : null;
      if (current.selectedId !== id || current.composeOpen) current.open(id);
    } else if (route.kind === 'draft') {
      if (!route.id || !current.drafts.some(item => item.id === route.id)) { if (current.composeOpen || current.selectedId) current.open(null); return; }
      if (!current.composeOpen || current.editingDraftId !== route.id) current.openDraft(route.id);
    } else if (route.kind === 'message') {
      const id = current.messages.some(item => item.id === route.id) ? route.id ?? null : null;
      if (current.composeOpen || current.selectedId !== id) current.open(id);
    } else if (route.kind === 'search' && (current.composeOpen || current.selectedId)) current.open(null);
  }, [route.kind, route.id, replyId, replyFromDrafts]);
  // A direct reader route has no search-row click to clear local unread state.
  // Wait until this exact Activity is foreground, and consume at most once for
  // the route entry so later explicit unread changes are not silently undone.
  React.useEffect(() => {
    if (route.kind !== 'message' || !route.id) return;
    const id = route.id;
    let consumed = false;
    const markRead = () => {
      if (consumed || !surfaceOwner()) return;
      const current = useMailStore.getState();
      if (current.composeOpen || current.selectedId !== id) return;
      const matches = current.messages.filter(item => item.id === id);
      if (matches.length !== 1) return;
      consumed = true;
      current.setUnread(matches[0], false);
    };
    const unsubscribe = TaskManager.subscribe(markRead);
    markRead();
    return unsubscribe;
  }, [location.key, route.kind, route.id, surfaceOwner]);
  const ownsComposer = () => {
    const current = useMailStore.getState();
    return isCurrent() && showComposer && current.composeOpen && current.editingDraftId === editingDraftId && current._temp?.composeEpoch === composeEpoch
      && (!editingDraftId || current.drafts.find(item => item.id === editingDraftId) === sourceDraft);
  };
  const closeEditor = () => { if (!isCurrent()) return; closeCompose(); if (inSearch) back(); };
  const saveEditor = () => { if (!ownsComposer()) return; saveDraft(); if (inSearch && !useMailStore.getState().composeOpen) back(); };
  const changeDraft = (patch: Parameters<typeof updateDraft>[0]) => { if (ownsComposer()) updateDraft(patch); };
  const verifyMessage = () => { if (isCurrent() && message && useMailStore.getState().messages.find(item => item.id === message.id) === message) verify(message.id); };
  const toggleMessageStar = () => {
    if (!message || !canUseReplySurface(isCurrent(), window.__OS__?.getState())) return;
    const current = useMailStore.getState();
    if (!current.composeOpen && current.selectedId === message.id) current.toggleStar(message);
  };
  const messageArchived = Boolean(message && archivedIds?.includes(message.id));
  const markMessageUnread = () => {
    if (!message || !canUseReplySurface(isCurrent(), window.__OS__?.getState())) return;
    const current = useMailStore.getState();
    if (current.composeOpen || current.selectedId !== message.id || current.unreadIds?.includes(message.id)) return;
    if (!current.setUnread(message, true)) return;
    const latest = useMailStore.getState();
    if (!isCurrent() || latest.composeOpen || latest.selectedId !== message.id || latest.messages.find(item => item.id === message.id) !== message) return;
    latest.open(null);
    if (inSearch) back();
  };
  const changeMessageArchive = (targetArchived: boolean, fromMenu = false) => {
    if (!message || !canUseReplySurface(isCurrent(false, fromMenu), window.__OS__?.getState())) return;
    const current = useMailStore.getState();
    if (current.composeOpen || current.selectedId !== message.id
      || Boolean(current.archivedIds?.includes(message.id)) !== messageArchived) return;
    if (!current.setArchived(message, targetArchived)) return;
    const latest = useMailStore.getState();
    if (!isCurrent(false, fromMenu) || latest.composeOpen || latest.selectedId !== message.id
      || latest.messages.find(item => item.id === message.id) !== message) return;
    if (fromMenu) { closeMessageMenu(); return; }
    latest.open(null);
    if (inSearch) back();
  };
  const openReply = (id: string, search: boolean) => {
    if (!canUseReplySurface(isCurrent(), window.__OS__?.getState()) || openingReply.current === location.key) return;
    const source = messages.find(item => item.id === id);
    if (!source || useMailStore.getState().messages.find(item => item.id === id) !== source) return;
    openingReply.current = location.key;
    if (search) go('mail.search.reply.open', { messageId: id });
    else if (inFolder) go('mail.folder.reply.open', { messageId: id, originFolder: folder! });
    else go('mail.reply.open', { messageId: id });
  };
  const resumeReplyDraft = (item: Draft) => {
    if (!item.replyTo || !canUseReplySurface(isCurrent(), window.__OS__?.getState())
      || useMailStore.getState().drafts.find(draft => draft.id === item.id) !== item || openingReply.current === location.key) return;
    openingReply.current = location.key;
    if (inFolder) go('mail.folder.reply.resume', { messageId: item.replyTo.messageId, originFolder: folder! });
    else go('mail.reply.resume', { messageId: item.replyTo.messageId });
  };
  const openSearch = () => {
    if (!isCurrent() || drawerOpen || openingSearch.current === location.key) return;
    openingSearch.current = location.key;
    if (composeOpen) closeCompose();
    if (inFolder) go('mail.folder.search.open', { originFolder: folder! });
    else go('mail.search.open');
  };
  const selectMessage = (item: Message) => {
    const current = useMailStore.getState();
    if (isCurrent() && current.messages.find(message => message.id === item.id) === item
      && (folder !== 'starred' || current.starredIds?.includes(item.id))
      && (folder !== 'inbox' || !current.archivedIds?.includes(item.id))) { current.setUnread(item, false); open(item.id); }
  };
  const selectDraft = (item: Draft) => {
    if (isCurrent() && useMailStore.getState().drafts.find(draft => draft.id === item.id) === item) openDraft(item.id);
  };

  useAppNavigationHandler("mail", {
    onBack: () => {
      if (messageMenuOpen) { closeMessageMenu(); return true; }
      if (drawerOpen || (folderPath && folder === null)) { back(); return true; }
      if (replyId !== null) { back(); return true; }
      if (inSearch) {
        if (route.kind === 'draft') closeCompose();
        else if (route.kind === 'message') open(null);
        back(); return true;
      }
      if (composeOpen) {
        closeCompose();
        return true;
      }
      if (selectedId) {
        open(null);
        return true;
      }
      if (inFolder) { back(); return true; }
      return false;
    },
  });

  if (replyId !== null) return <MailReplyPage messageId={replyId} />;
  if (folderPath && folder === null) return <div className="mroot"><button type="button" {...bindTap('system.back')}>{s.inbox}</button><p role="status">{s.folder_unavailable}</p></div>;

  const contentOpen = Boolean(message || showComposer || route.kind === 'message' || route.kind === 'draft');
  return (
    <div className="mroot">
      <div className={contentOpen ? "mlayout open" : "mlayout"} inert={drawerOpen || messageMenuOpen || undefined} aria-hidden={drawerOpen || messageMenuOpen || undefined} data-mail-compose-active={showComposer || route.kind === 'draft' || undefined} data-mail-search-active={inSearch || undefined}>
        <section className="mlist" hidden={inSearch || showComposer} data-scroll-container="messages" data-scroll-direction="vertical">
          <div className="mbrand">
            <button type="button" ref={folderButton} className="mail-folder-launch" aria-label={s.folders}
              {...(inFolder
                ? bindTap('mail.folder.folders.open', { params: { folder: folder! }, onTrigger: () => { if (isCurrent() && !drawerOpen) { window.__OS__?.keyboard.hide(); go('mail.folder.folders.open', { folder: folder! }); } } })
                : bindTap('mail.folders.open', { onTrigger: () => { if (isCurrent() && !drawerOpen) { window.__OS__?.keyboard.hide(); go('mail.folders.open'); } } }))}><IcMailMenu size={23} /></button>
            <IcLauncher /> <span>{s.app_name}</span>
          </div>
          <button type="button" className="mail-search-launch" {...(inFolder
            ? bindTap('mail.folder.search.open', { params: { originFolder: folder! }, onTrigger: openSearch })
            : bindTap('mail.search.open', { onTrigger: openSearch }))}><IcMailSearch size={20} /><span>{s.search_mail}</span></button>
          <button
            {...(inFolder
              ? bindTap({ kind: 'action', id: 'mail.folder.compose.open' }, { onTrigger: () => { if (isCurrent()) beginCompose(); } })
              : { 'data-action': 'mail.compose.open', onClick: () => { if (isCurrent()) beginCompose(); } })}
            className="compose"
          >
            <PenLine size={20} /> {s.compose}
          </button>
          <div className="section-label">
            {folder === 'starred' ? <IcMailStar size={19} /> : folder === 'drafts' ? <IcMailDrafts size={19} /> : folder === 'all' ? <IcMailAll size={19} /> : <Inbox size={19} />} {folderTitle}
          </div>
          {folderRows.messages.map((item) => (
            <button
              key={item.id}
              {...(inFolder
                ? bindTap({ kind: 'action', id: 'mail.folder.message.item.open' }, { params: { id: item.id }, onTrigger: () => selectMessage(item) })
                : { 'data-action': 'mail.message.open', 'data-action-params': JSON.stringify({ id: item.id }), onClick: () => selectMessage(item) })}
              className={item.id === selectedId ? "mrow active" : "mrow"}
              data-mail-unread={unreadIds?.includes(item.id) ? 'true' : undefined}
            >
              <span className="mail-reference-avatar" aria-hidden="true">{item.from.trim().slice(0, 1)}</span>
              <span className="mail-reference-row-copy"><b>{item.from}</b>
                <span>{item.subject}</span><small>{item.body.split('\n')[0]}</small></span>
              <span className="mail-reference-date">{item.date}
                {unreadIds?.includes(item.id) && <span className="mail-unread-badge">{s.unread_message}</span>}
                {starredIds?.includes(item.id) && <span className="mail-reference-starred" aria-label={s.starred_message}><IcMailStar size={18} aria-hidden="true" /></span>}
              </span>
            </button>
          ))}
          {!folderRows.messages.length && !folderRows.drafts.length && <p className="mail-folder-empty" role="status">{s.folder_empty}</p>}
          {folder === 'inbox' && <div className="section-label" style={{ marginTop: 12 }}>
            <Archive size={19} /> {s.drafts} ({drafts.length})
          </div>}
          {folderRows.drafts.map(item => (
            <button key={item.id} type="button"
              {...(item.replyTo
                ? inFolder
                  ? bindTap('mail.folder.reply.resume', { params: { messageId: item.replyTo.messageId, originFolder: folder! }, onTrigger: () => resumeReplyDraft(item) })
                  : bindTap('mail.reply.resume', { params: { messageId: item.replyTo.messageId }, onTrigger: () => resumeReplyDraft(item) })
                : inFolder
                  ? bindTap({ kind: 'action', id: 'mail.folder.draft.item.open' }, { params: { id: item.id }, onTrigger: () => selectDraft(item) })
                  : { 'data-action': 'mail.draft.open', 'data-action-type': 'tap', 'data-action-params': JSON.stringify({ id: item.id }), onClick: () => selectDraft(item) })}
              className={composeOpen && editingDraftId === item.id ? 'mrow active' : 'mrow'}
              aria-label={`${s.open_draft}: ${item.subject || s.untitled_draft}`}>
              <span className="mail-reference-avatar" aria-hidden="true"><PenLine size={18} /></span>
              <span className="mail-reference-row-copy"><b>{item.subject || s.untitled_draft}</b>
                <span>{item.to}</span><small>{item.body.split('\n')[0]}</small></span>
            </button>
          ))}
          {!!conflicts.length && <section className="mail-recovery-list" aria-label={s.recovery_title}>
            <h2>{s.recovery_title}</h2>{recoveryBlocked && <p>{s.recovery_blocked}</p>}
            {conflicts.map(([key, input]) => <button type="button" key={key} disabled={recoveryBlocked} className="mrow"
              {...(inFolder
                ? bindTap({ kind: 'action', id: 'mail.folder.recovery.item.open' }, { params: { id: key }, onTrigger: () => { if (isCurrent()) openRecovery(key); } })
                : bindTap({ kind: 'action', id: 'mail.recovery.item.open' }, { params: { id: key }, onTrigger: () => { if (isCurrent()) openRecovery(key); } }))}>
              <span className="mail-reference-row-copy"><b>{input.subject || s.untitled_draft}</b><span>{input.to}</span><small>{s.recovery_open}</small></span>
            </button>)}
          </section>}
        </section>

        <div className="mail-search-owner" hidden={!inSearch || showComposer || route.kind === 'draft'} inert={!inSearch || showComposer || undefined}>
          <MailSearchPanel messages={messages} drafts={drafts} />
        </div>
        {showComposer ? (
          <article className="mcompose show" data-benchmark-route="compose">
            <div className="compose-head">
              <h2>{editingDraftId ? s.edit_draft : s.compose_title}</h2>
              <button style={{ order: 0 }} onClick={closeEditor} aria-label={s.close_compose}>
                <IcMailBack size={22} />
              </button>
              <button disabled={!draftAvailable || attachmentBusy} data-keep-keyboard onPointerDown={event => event.preventDefault()} style={{ order: 2 }} aria-label={s.attach_file}
                {...(inSearch ? bindTap({ kind: 'action', id: 'mail.search.draft.attach.open' }, { onTrigger: () => { if (ownsComposer()) openPicker(); } })
                  : inFolder ? bindTap({ kind: 'action', id: 'mail.folder.compose.attach.open' }, { onTrigger: () => { if (ownsComposer()) openPicker(); } })
                    : bindTap({ kind: 'action', id: 'mail.compose.attach.open' }, { onTrigger: () => { if (ownsComposer()) openPicker(); } }))}>
                <IcAttachment />
              </button>
            </div>
            {!draftAvailable && <p role="status">{draftExists ? s.draft_source_changed : s.draft_unavailable}</p>}
            <p className="mail-local-only">{s.compose_local_only}</p>
            {attachmentError && <p role="alert">{s.attachment_picker_failed}</p>}
            <div className="compose-form" data-scroll-container="compose" data-scroll-direction="vertical">
              <label className="mail-compose-recipient">
                <span>{s.recipient}</span>
                <input
                  {...(inSearch ? { 'data-action': 'mail.search.draft.to.input' } : inFolder ? { 'data-action': 'mail.folder.compose.to.input' } : { 'data-action': 'mail.compose.to.input' })} data-action-type="input" data-action-params={JSON.stringify({ value: draft.to })} aria-label={s.recipient}
                  data-benchmark-field="mail-to"
                  value={draft.to} readOnly={!draftAvailable}
                  onChange={(event) => changeDraft({ to: event.target.value })}
                />
              </label>
              <input
                {...(inSearch ? { 'data-action': 'mail.search.draft.subject.input' } : inFolder ? { 'data-action': 'mail.folder.compose.subject.input' } : { 'data-action': 'mail.compose.subject.input' })} data-action-type="input" data-action-params={JSON.stringify({ value: draft.subject })} aria-label={s.subject}
                data-benchmark-field="mail-subject"
                value={draft.subject} readOnly={!draftAvailable}
                placeholder={s.subject}
                onChange={(event) => changeDraft({ subject: event.target.value })}
              />
              <textarea
                {...(inSearch ? { 'data-action': 'mail.search.draft.body.input' } : inFolder ? { 'data-action': 'mail.folder.compose.body.input' } : { 'data-action': 'mail.compose.body.input' })} data-action-type="input" data-action-params={JSON.stringify({ value: draft.body })} aria-label={s.body}
                data-benchmark-field="mail-body"
                value={draft.body} readOnly={!draftAvailable}
                placeholder={s.body}
                onChange={(event) => changeDraft({ body: event.target.value })}
              />
              {!!draft.attachments?.length && <section className="mail-attachments" aria-label={s.attachments}>
                {draft.attachments.map(reference => {
                  const node = FileSystem.getNode(reference.path);
                  return <div key={reference.id} className="mail-attachment" data-mail-attachment-id={reference.id}>
                    <IcAttachment size={18} />
                    <MailAttachmentMetadata reference={reference} node={node} unavailable={s.attachment_unavailable} />
                    <button data-keep-keyboard aria-label={s.attachment_remove}
                      {...(inSearch ? bindTap({ kind: 'action', id: 'mail.search.draft.attachment.item.remove' }, { params: { id: reference.id }, onTrigger: () => { if (ownsComposer()) removeAttachment(reference.id); } })
                        : inFolder ? bindTap({ kind: 'action', id: 'mail.folder.compose.attachment.item.remove' }, { params: { id: reference.id }, onTrigger: () => { if (ownsComposer()) removeAttachment(reference.id); } })
                          : bindTap({ kind: 'action', id: 'mail.compose.attachment.item.remove' }, { params: { id: reference.id }, onTrigger: () => { if (ownsComposer()) removeAttachment(reference.id); } }))}>
                      <IcRemoveAttachment size={18} />
                    </button>
                  </div>;
                })}
                <small>{s.attachment_reference_note}</small>
              </section>}
            </div>
            <button
              {...(inSearch ? { 'data-action': 'mail.search.draft.save', onClick: saveEditor }
                : inFolder ? bindTap({ kind: 'action', id: 'mail.folder.compose.save' }, { onTrigger: saveEditor })
                  : { 'data-action': 'mail.compose.save', onClick: saveEditor })}
              data-benchmark-action="save-mail-draft"
              data-keep-keyboard onPointerDown={event => event.preventDefault()}
              className="draft-save"
              disabled={!draftAvailable || !draft.to.trim() || !draft.subject.trim() || !draft.body.trim()}
            >
              <Save size={18} /> {s.save_draft}
            </button>
          </article>
        ) : message ? (
          <article
            className="mdetail show"
            data-scroll-container="message" data-scroll-direction="vertical"
            data-benchmark-message-id={message.id}
          >
            <div className="message-actions">
              <button type="button" className="mail-reader-back" aria-label={inSearch ? s.search_back : s.inbox} {...bindTap('system.back')}><IcMailBack size={21} /></button>
              <button type="button" className="mail-reader-unread" aria-label={s.mark_unread}
                {...(inSearch
                  ? bindTap({ kind: 'action', id: 'mail.search.reader.item.unread.set' }, { params: { id: message.id }, onTrigger: markMessageUnread })
                  : inFolder
                    ? bindTap({ kind: 'action', id: 'mail.folder.reader.item.unread.set' }, { params: { id: message.id }, onTrigger: markMessageUnread })
                    : bindTap({ kind: 'action', id: 'mail.reader.item.unread.set' }, { params: { id: message.id }, onTrigger: markMessageUnread }))}>
                <MailOpen size={24} aria-hidden="true" />
              </button>
              <button type="button" className="mail-reader-archive" aria-label={s.archive_message} disabled={messageArchived}
                {...(inSearch
                  ? bindTap({ kind: 'action', id: 'mail.search.reader.item.archive.set' }, { params: { id: message.id, archived: true }, onTrigger: () => changeMessageArchive(true) })
                  : inFolder
                    ? bindTap({ kind: 'action', id: 'mail.folder.reader.item.archive.set' }, { params: { id: message.id, archived: true }, onTrigger: () => changeMessageArchive(true) })
                    : bindTap({ kind: 'action', id: 'mail.reader.item.archive.set' }, { params: { id: message.id, archived: true }, onTrigger: () => changeMessageArchive(true) }))}>
                <Archive size={24} aria-hidden="true" />
              </button>
              <button ref={messageMenuButton} type="button" className="mail-reader-more" aria-label={s.more_message_actions}
                {...(inSearch
                  ? bindTap('mail.search.reader.menu.open', { onTrigger: () => { if (isCurrent()) { window.__OS__?.keyboard.hide(); go('mail.search.reader.menu.open', { messageId: message.id }); } } })
                  : inFolder
                    ? bindTap('mail.folder.reader.menu.open', { onTrigger: () => { if (isCurrent()) { window.__OS__?.keyboard.hide(); go('mail.folder.reader.menu.open', { folder: folder! }); } } })
                    : bindTap('mail.reader.menu.open', { onTrigger: () => { if (isCurrent()) { window.__OS__?.keyboard.hide(); go('mail.reader.menu.open'); } } }))}>
                <MoreVertical size={24} aria-hidden="true" />
              </button>
            </div>
            <div className="mail-reader-title">
              <h2 className="mail-reader-subject">{message.subject}</h2>
              <button type="button" className="mail-reader-star" aria-pressed={starredIds?.includes(message.id) ?? false}
                aria-label={starredIds?.includes(message.id) ? s.unstar_message : s.star_message}
                {...(inSearch
                  ? bindTap({ kind: 'action', id: 'mail.search.reader.item.star.toggle' }, { params: { id: message.id }, onTrigger: toggleMessageStar })
                  : inFolder ? bindTap({ kind: 'action', id: 'mail.folder.reader.item.star.toggle' }, { params: { id: message.id }, onTrigger: toggleMessageStar })
                    : bindTap({ kind: 'action', id: 'mail.reader.item.star.toggle' }, { params: { id: message.id }, onTrigger: toggleMessageStar }))}>
                <IcMailStar size={23} aria-hidden="true" />
              </button>
            </div>
            <div className="mail-reader-sender">
              <span className="mail-reference-avatar" aria-hidden="true">{Array.from(message.from.trim())[0]}</span>
              <div className="mail-reader-sender-copy">
                <div className="mail-reader-sender-heading">
                  <strong aria-label={`${s.from}：${message.from}`}>{message.from}</strong>
                  <small>{message.date}</small>
                </div>
                <p className="sender-address" data-mail-sender-address>
                  {s.sender_address}：<span>{message.senderAddress?.trim() || s.sender_address_unavailable}</span>
                </p>
              </div>
            </div>
            <div className="body" data-os-clipboard="true">{message.body}</div>
            <button type="button" className="verify" disabled={!replyAddress(message)}
              {...(inSearch ? bindTap('mail.search.reply.open', { params: { messageId: message.id }, onTrigger: () => openReply(message.id, true) })
                : inFolder ? bindTap('mail.folder.reply.open', { params: { messageId: message.id, originFolder: folder! }, onTrigger: () => openReply(message.id, false) })
                  : bindTap('mail.reply.open', { params: { messageId: message.id }, onTrigger: () => openReply(message.id, false) }))}>{s.reply}</button>
            {!replyAddress(message) && <p className="mail-local-only">{s.reply_address_missing}</p>}
            <button
              {...(inSearch ? { 'data-action': 'mail.search.message.item.verify', 'data-action-params': JSON.stringify({ id: message.id }), onClick: verifyMessage }
                : inFolder ? bindTap({ kind: 'action', id: 'mail.folder.fact.verify' }, { onTrigger: verifyMessage })
                  : { 'data-action': 'mail.fact.verify', onClick: verifyMessage })}
              className="verify"
            >
              <CheckCircle2 size={17} />
              {verifiedIds.includes(message.id) ? s.verified : s.verify}
            </button>
          </article>
        ) : route.kind === 'message' || route.kind === 'draft' ? (
          <article className="mdetail show mail-search-unavailable"><button type="button" {...bindTap('system.back')}>{s.search_back}</button><p role="status">{route.kind === 'message' ? s.message_unavailable : s.draft_unavailable}</p></article>
        ) : (
          <section className="empty-mail"><div className="mail-reference-empty">
            <span className="mail-reference-envelopes" aria-hidden="true" />
            <p>{s.select_conversation}</p>
          </div></section>
        )}
      </div>
      {drawerOpen && <MailFolderDrawer folder={folder ?? 'inbox'} />}
      {messageMenuOpen && <div className="mail-folder-overlay mail-reader-menu-overlay">
        <button type="button" className="mail-folder-backdrop" aria-label={s.close_message_actions} {...menuBackBinding} onClick={event => { if (isCurrent(false, true)) menuBackBinding.onClick?.(event); }} />
        <section ref={messageMenuRef} role="dialog" aria-modal="true" aria-label={s.more_message_actions} className="mail-reader-menu"
          data-scroll-container="messageMenu" data-scroll-direction="vertical" onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (isCurrent(false, true)) closeMessageMenu(); }
            if (event.key === 'Tab') {
              const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
              const index = buttons.indexOf(document.activeElement as HTMLButtonElement); event.preventDefault();
              buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
            }
          }}>
          <h2>{s.more_message_actions}</h2>
          <p role="status">{!message ? s.message_unavailable : !messageArchived ? s.already_inbox : message.subject}</p>
          <button type="button" disabled={!message || !messageArchived} data-mail-restore
            {...(inSearch
              ? bindTap({ kind: 'action', id: 'mail.search.reader.menu.item.restore' }, { params: { id: message?.id ?? '' }, onTrigger: () => changeMessageArchive(false, true) })
              : inFolder
                ? bindTap({ kind: 'action', id: 'mail.folder.reader.menu.item.restore' }, { params: { id: message?.id ?? '' }, onTrigger: () => changeMessageArchive(false, true) })
                : bindTap({ kind: 'action', id: 'mail.reader.menu.item.restore' }, { params: { id: message?.id ?? '' }, onTrigger: () => changeMessageArchive(false, true) }))}>{s.move_to_inbox}</button>
          <button type="button" {...menuBackBinding} onClick={event => { if (isCurrent(false, true)) menuBackBinding.onClick?.(event); }}>{s.close_message_actions}</button>
        </section>
      </div>}
    </div>
  );
};

export default function MailApp() {
  return (
    <div className="h-full w-full pt-10" data-status-bar-foreground="dark">
      <MemoryRouter>
        <MailActivityNavigation />
        <Routes><Route path="/compose/to" element={<MailtoComposePage />} /><Route path="/" element={<MailInbox />}>
          <Route index element={null} />
          <Route path="folder/:folder" element={null} />
          <Route path="search" element={null} />
          <Route path="search/message/:messageId" element={null} />
          <Route path="search/draft/:draftId" element={null} />
          <Route path="reply/:messageId" element={null} />
          <Route path="*" element={null} />
        </Route></Routes>
      </MemoryRouter>
    </div>
  );
}
