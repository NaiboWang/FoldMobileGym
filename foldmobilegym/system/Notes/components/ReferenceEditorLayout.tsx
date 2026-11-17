import React from 'react';
import { ReferenceLibraryGroup } from './ReferenceLibraryGroup';
import { useLocation } from 'react-router-dom';
import { useNotesStore, selectVisibleNotes } from '../state';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcAdd, IcAiNotes, IcFile, IcFolder, IcLock, IcSettings, IcTrash } from '../res/icons';
import '../reference.css';
import { NoteCreationPalette } from './NoteCreationPalette';
import { isNoteCreationMenu } from '../creationMenu';
import { useNoteInteractionOwner } from '../hooks/useNoteInteractionOwner';
import { getNoteEditorSheet } from '../editorOverlay';
import { isFullNoteEditor } from '../editorView';
import { groupReferenceNotes, noteLibraryDate, noteLibraryGroupLabel, noteLibraryGreeting } from '../referenceLibrary';
import * as TimeService from '../../../os/TimeService';
import { useLocale } from '../../../os/locale';
import { useSystemEvent } from '../../../os/hooks/useSystemEvent';
import { ACTION_TIME_SET, ACTION_TIME_TICK } from '../../../os/BroadcastBus';

/** Layout only: the editor stays mounted across posture changes. */
export function ReferenceEditorLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const notes = useNotesStore(selectVisibleNotes);
  const { bindTap, go } = useNotesGestures();
  const owner = useNoteInteractionOwner('new', () => null);
  const s = useAppStrings(strings, stringsEn);
  const overlay = getNoteEditorSheet(location.pathname, location.search);
  const editing = location.pathname.startsWith('/note/');
  const creation = isNoteCreationMenu(location.pathname, location.search);
  const focused = isFullNoteEditor(location.pathname, location.search);
  const locale = useLocale();
  const [now, setNow] = React.useState(TimeService.now);
  const refreshTime = () => setNow(TimeService.now());
  useSystemEvent(ACTION_TIME_SET, refreshTime, { enabled: editing });
  useSystemEvent(ACTION_TIME_TICK, refreshTime, { enabled: editing });
  React.useEffect(() => { if (editing) setNow(TimeService.now()); }, [editing]);
  const groups = React.useMemo(() => groupReferenceNotes(notes, now), [notes, now]);
  const id = editing ? decodeURIComponent(location.pathname.slice('/note/'.length)) : '';
  return <div className="notes-reference-layout h-full w-full bg-white relative overflow-hidden" data-notes-view={focused ? 'full' : 'parallel'}>
    {editing && <aside className="notes-reference-master" aria-label={s.notes} inert={!!overlay || focused} aria-hidden={overlay || focused ? true : undefined}>
      {/* Keep pressed controls stable until click; navigation owns input teardown. */}
      <nav className="notes-reference-rail" aria-label={s.app_name}>
        <button data-keep-keyboard="true" className="notes-reference-rail-add" {...bindTap('notes.editor.create.open', {params:{id}, onTrigger: () => { if (owner.active()) { window.__OS__?.keyboard.hide(); go('notes.editor.create.open', {id}); } }})} aria-label={s.action_new_note} title={s.action_new_note}><IcAdd size={24} /></button>
        <button data-keep-keyboard="true" className="is-active" {...bindTap('home.open')} aria-label={s.notes} title={s.notes}><IcFile size={25} /></button>
        <button data-keep-keyboard="true" {...bindTap('notes.editor.rail.folders.open')} aria-label={s.folders} title={s.folders}><IcFolder size={23} /></button>
        <button data-keep-keyboard="true" {...bindTap('notes.editor.rail.private.open')} aria-label={s.private_notes} title={s.private_notes}><IcLock size={22} /></button>
        <button data-keep-keyboard="true" {...bindTap('notes.editor.rail.trash.open')} aria-label={s.trash} title={s.trash}><IcTrash size={22} /></button>
        <button data-keep-keyboard="true" {...bindTap('notes.editor.rail.settings.open')} aria-label={s.settings} title={s.settings}><IcSettings size={22} /></button>
        <span className="notes-reference-rail-spacer" />
      </nav>
      <div className="notes-reference-library">
        <header>
          <strong>{s.library_all_notes}</strong>
          <button
            data-keep-keyboard="true"
            data-notes-ai-open="master"
            aria-label={s.ai_title}
            title={s.ai_title}
            disabled={!id || id === 'new'}
            {...(id && id !== 'new' ? bindTap('notes.editor.ai.open', { params: { id } }) : {})}
          ><IcAiNotes size={24} /></button>
        </header>
        <p className="notes-reference-summary" data-notes-library-summary="true" aria-live="polite">
          <span data-notes-greeting="true">{noteLibraryGreeting(now, s)}</span>
          {s.library_summary_prefix.split('{greeting}')[1]}
          <strong data-notes-count="true">{new Intl.NumberFormat(locale).format(notes.length)}</strong>
          {notes.length === 1 ? s.library_summary_one : s.library_summary_many}
        </p>
        <div className="notes-reference-master-list" data-scroll-container="master" data-scroll-direction="vertical">
          {groups.length ? groups.map(group => <section key={group.key} data-notes-group={group.key}>
            <ReferenceLibraryGroup pinned={group.kind === 'pinned'} label={noteLibraryGroupLabel(group, now, locale, s)}>
            {group.notes.map(note => <button data-keep-keyboard="true" key={note.id} data-notes-note-id={note.id}
              {...bindTap('note.open', {params:{id:note.id}})}
              aria-current={id === note.id ? 'page' : undefined}>
              <strong>{note.title.trim() || s.untitled}</strong>
              <span className="notes-reference-preview">
                {noteLibraryDate(note.updatedAt, now, locale) && <time dateTime={TimeService.fromTimestamp(note.updatedAt).toISOString()}>{noteLibraryDate(note.updatedAt, now, locale)}</time>}
                <span>{note.content.replace(/\s+/g, ' ').trim() || s.library_no_text}</span>
              </span>
            </button>)}
            </ReferenceLibraryGroup>
          </section>) : <p className="notes-reference-empty">{s.empty_notes}</p>}
        </div>
        <button data-keep-keyboard="true" className="notes-reference-home" {...bindTap('home.open')}>{s.notes}</button>
      </div>
    </aside>}
    <main className="notes-reference-detail" inert={creation} aria-hidden={creation ? true : undefined}>{children}</main>
    {creation && <NoteCreationPalette key={location.key} />}
  </div>;
}
