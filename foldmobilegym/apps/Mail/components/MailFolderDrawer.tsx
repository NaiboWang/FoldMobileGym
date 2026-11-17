import React from 'react';
import { useTriggerGestures } from '@/os/hooks/useTriggerGestures';
import { useAppStrings } from '@/os/useAppStrings';
import { useMailNavigate } from '../navigation';
import { useMailSurfaceOwner } from '../hooks/useMailSurfaceOwner';
import { useMailStore } from '../state';
import type { MailFolder } from '../folders';
import { mailFolderRows } from '../folders';
import { IcLauncher, IcMailInbox, IcMailStar, IcMailDrafts, IcMailAll } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function MailFolderDrawer({ folder }: { folder: MailFolder }) {
  const s = useAppStrings(strings, stringsEn), { go, back } = useMailNavigate();
  const { bindTap } = useTriggerGestures(), owns = useMailSurfaceOwner();
  const initialOwner = React.useRef(owns);
  const panel = React.useRef<HTMLElement>(null), claimed = React.useRef(false);
  const messages = useMailStore(state => state.messages), drafts = useMailStore(state => state.drafts);
  const stars = useMailStore(state => state.starredIds);
  const archives = useMailStore(state => state.archivedIds);
  React.useEffect(() => { if (initialOwner.current()) panel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }, []);
  const select = (next: MailFolder) => {
    const os = window.__OS__?.getState();
    if (!owns() || os?.isLauncherVisible || os?.isRecentsVisible || claimed.current) return;
    claimed.current = true;
    useMailStore.getState().open(null);
    if (next === folder) { back(); return; }
    if (next === 'inbox') go('mail.folders.inbox');
    else go('mail.folders.select', { folder: next });
  };
  return <div className="mail-folder-overlay">
    <button type="button" className="mail-folder-backdrop" aria-label={s.close_folders} {...bindTap('system.back')} />
    <nav ref={panel} className="mail-folder-drawer" role="dialog" aria-modal="true" aria-label={s.folders}
      data-scroll-container="folders" data-scroll-direction="vertical"
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
        if ((event.shiftKey && document.activeElement === buttons[0]) || (!event.shiftKey && document.activeElement === buttons.at(-1))) {
          event.preventDefault(); (event.shiftKey ? buttons.at(-1) : buttons[0])?.focus();
        }
      }}>
      <div className="mail-folder-brand"><IcLauncher /><span>{s.app_name}</span></div>
      <button type="button" aria-current={folder === 'inbox' ? 'page' : undefined}
        {...bindTap('mail.folders.inbox', { onTrigger: () => select('inbox') })}>
        <IcMailInbox size={21} /><span>{s.inbox}</span><small>{mailFolderRows('inbox', messages, drafts, stars, archives).messages.length}</small>
      </button>
      {([
        ['starred', s.starred_folder, IcMailStar, messages.filter(message => stars?.includes(message.id)).length],
        ['drafts', s.drafts, IcMailDrafts, drafts.length],
        ['all', s.all_mail, IcMailAll, messages.length],
      ] as const).map(([id, label, Icon, count]) => <button type="button" key={id} aria-current={folder === id ? 'page' : undefined}
        {...bindTap('mail.folders.select', { params: { folder: id }, onTrigger: () => select(id) })}>
        <Icon size={21} /><span>{label}</span><small>{count}</small>
      </button>)}
    </nav>
  </div>;
}
