import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityContext } from '../../../os/ActivityContext';
import TaskManager from '../../../os/TaskManager';
import { isDocumentReference } from '../../../os/utils/documentReference';
import { importNoteDocument, NoteImportError, type NoteImportFailure } from '../noteDocumentImport';
import { useNotesStore } from '../state';
import type { Note } from '../types';

/** Expected foreign picker may background Notes; actual decoding requires its caller. */
export function useNoteDocumentImport(options: { active: () => boolean; fallbackTitle: string; onCreated: (note: Note) => void }) {
  const location = useLocation(), { navigator } = useContext(UNSAFE_NavigationContext);
  const { activityId, taskId } = useActivityContext();
  const latest = useRef({ options, key: location.key }); latest.current = { options, key: location.key };
  const life = useRef({ mounted: false, request: 0, controller: null as AbortController | null }).current;
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<NoteImportFailure | null>(null);
  useLayoutEffect(() => { life.mounted = true; return () => { life.mounted = false; life.request++; life.controller?.abort(); }; }, [life]);
  const pick = () => {
    if (pending.current || !life.mounted || !latest.current.options.active()) return;
    const key = location.key, token = ++life.request, abort = new AbortController();
    life.controller = abort; pending.current = true; setBusy(true); setError(null);
    const owns = () => {
      const os = TaskManager.getState(), live = (navigator as unknown as { location?: { key: string } }).location;
      return life.mounted && life.request === token && latest.current.key === key && (!live || live.key === key)
        && !os.isLauncherVisible && !os.isRecentsVisible && os.activeTaskId === taskId
        && os.tasks.find(task => task.taskId === taskId)?.stack.at(-1)?.activityId === activityId;
    };
    const complete = (failure: NoteImportFailure | null = null) => {
      if (!life.mounted || life.request !== token) return;
      pending.current = false; setBusy(false); setError(failure);
    };
    let received = false;
    window.__OS__?.keyboard.hide();
    try {
      const launched = window.__OS__?.startActivityForResult({ action: 'ACTION_OPEN_DOCUMENT', type: 'text/*' }, async result => {
        if (received || !life.mounted || life.request !== token) return;
        received = true;
        if (result.resultCode === 'CANCELED') { complete(); return; }
        if (result.resultCode !== 'OK' || !isDocumentReference(result.data?.document)) { complete('unavailable'); return; }
        try {
          await importNoteDocument(result.data.document, owns, abort.signal, latest.current.options.fallbackTitle, text => {
            if (!owns()) throw new NoteImportError('cancelled');
            const note = useNotesStore.getState().addNote({ ...text, folderId: 'unfiled' });
            latest.current.options.onCreated(note);
          });
          complete();
        } catch (failure) { complete(failure instanceof NoteImportError ? failure.code : 'unavailable'); }
      });
      if (!launched) complete('unavailable');
    } catch { complete('unavailable'); }
  };
  return { pick, busy, error };
}
