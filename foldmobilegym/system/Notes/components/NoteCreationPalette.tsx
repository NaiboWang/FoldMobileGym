import React from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityContext } from '../../../os/ActivityContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcAudioLines, IcFile, IcFileDown, IcPenTool } from '../res/icons';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { useNoteInteractionOwner } from '../hooks/useNoteInteractionOwner';
import { useNoteDocumentImport } from '../hooks/useNoteDocumentImport';

export function NoteCreationPalette() {
  const location = useLocation(), editor = location.pathname !== '/';
  const s = useAppStrings(strings, stringsEn), { activityId } = useActivityContext();
  const { bindBack, bindTap, go } = useNotesGestures();
  const owner = useNoteInteractionOwner('new', () => null);
  const importer = useNoteDocumentImport({ active: owner.active, fallbackTitle: s.import_untitled,
    onCreated: note => { if (editor) go('notes.editor.import.open', { id: note.id }); else go('notes.list.import.open', { id: note.id }); } });
  const helpId = `notes-create-help-${activityId}`;
  const error = importer.error === 'unsupported' ? s.import_unsupported : importer.error === 'size' ? s.import_size
    : importer.error === 'encoding' ? s.import_encoding : importer.error === 'changed' ? s.import_changed
    : importer.error === 'cancelled' ? s.import_cancelled : s.import_unavailable;
  return <div className="notes-create-overlay" data-notes-create-menu data-create-origin={editor ? 'editor' : 'home'}>
    <button className="notes-create-backdrop" {...bindBack()} aria-label={s.action_close} />
    <section className="notes-create-palette" role="dialog" aria-modal="true" aria-label={s.action_new_note} aria-describedby={helpId} data-scroll-container="create" data-scroll-direction="vertical">
      <button type="button" data-notes-create-type="text" disabled={importer.busy}
        {...(editor ? bindTap('notes.editor.rail.note.new', { params: { id: 'new' }, onTrigger: () => {
          if (owner.active() && !importer.busy) go('notes.editor.rail.note.new', { id: 'new' });
        } }) : bindTap('note.new', { params: { id: 'new' }, onTrigger: () => {
          if (owner.active() && !importer.busy) go('note.new', { id: 'new' });
        } }))}><span className="notes-create-icon"><IcFile size={23} /></span><span>{s.create_text}</span></button>
      <button type="button" data-notes-create-type="handwriting" disabled title={s.create_unavailable}><span className="notes-create-icon notes-create-icon-ring"><IcPenTool size={18} /></span><span>{s.create_handwriting}</span></button>
      <button type="button" data-notes-create-type="recording" disabled title={s.create_unavailable}><span className="notes-create-icon"><IcAudioLines size={23} /></span><span>{s.create_recording}</span></button>
      <button type="button" data-notes-create-type="import" disabled={importer.busy}
        {...bindTap(editor ? { kind: 'action', id: 'notes.editor.import.choose' } : { kind: 'action', id: 'notes.list.import.choose' }, { onTrigger: () => { if (owner.active()) importer.pick(); } })}><span className="notes-create-icon"><IcFileDown size={23} /></span><span>{s.create_import}</span></button>
      <p id={helpId} className="sr-only">{s.import_hint} {s.create_unavailable}</p>
      {importer.busy && <p role="status">{s.import_loading}</p>}
      {importer.error && <p role="alert">{error}</p>}
    </section>
  </div>;
}
