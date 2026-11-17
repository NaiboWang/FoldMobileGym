import { useEffect, useRef, useState } from 'react';
import { useMailStore } from '../state';
import * as FileSystem from '../../../os/FileSystemService';
import { isDocumentReference, matchesDocumentReference } from '../../../os/utils/documentReference';

export function useMailAttachmentPicker() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const pending = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const openPicker = () => {
    if (pending.current) return;
    const state = useMailStore.getState();
    if (!state.composeOpen || (state.editingDraftId && !state.drafts.some(item => item.id === state.editingDraftId))) return;
    const source = state.editingDraftId ? state.drafts.find(item => item.id === state.editingDraftId) : undefined;
    const owner = { key: state.editingDraftId ? `saved:${state.editingDraftId}` : 'new', epoch: state._temp?.composeEpoch ?? 0 };
    pending.current = true; setBusy(true); setError(false);
    window.__OS__?.keyboard.hide();
    const launched = window.__OS__?.startActivityForResult({ action: 'ACTION_OPEN_DOCUMENT', type: '*/*' }, result => {
      pending.current = false;
      if (!alive.current) return;
      setBusy(false);
      const current = useMailStore.getState();
      if (!current.composeOpen || owner.key !== (current.editingDraftId ? `saved:${current.editingDraftId}` : 'new')
        || owner.epoch !== (current._temp?.composeEpoch ?? 0) || (source && current.drafts.find(item => item.id === source.id) !== source)) return;
      if (result.resultCode === 'CANCELED') return;
      const reference = result.data?.document;
      if (result.resultCode !== 'OK' || !isDocumentReference(reference)
        || !matchesDocumentReference(reference, FileSystem.getNode(reference.path))) { setError(true); return; }
      useMailStore.getState().addAttachment(owner, reference);
    });
    if (!launched) { pending.current = false; setBusy(false); setError(true); }
  };
  return { openPicker, busy, error };
}
