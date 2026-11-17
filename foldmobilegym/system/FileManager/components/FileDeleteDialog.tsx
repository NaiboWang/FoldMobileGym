import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { FSNode } from '@/os/types';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { deleteNodes } from '../utils/deleteNodes';
import { ConfirmDialog } from './Dialog';

interface Props {
  open: boolean;
  nodes: FSNode[];
  onClose: () => void;
  onResult: (resolvedIds: string[]) => void;
  onSuccess: () => void;
  showToast: (message: string) => void;
}
interface Batch { targets: FSNode[]; deleted: number; changed: number; failed: number; directory: boolean }
const emptyBatch = (): Batch => ({ targets: [], deleted: 0, changed: 0, failed: 0, directory: false });

/** One URL-owned confirmation, with immutable targets and retryable IO failures. */
export function FileDeleteDialog(props: Props) {
  const s = useAppStrings(strings, stringsEn);
  const location = useLocation();
  const latest = useRef({ ...props, key: location.key });
  latest.current = { ...props, key: location.key };
  const mounted = useRef(true);
  const pending = useRef<symbol | null>(null);
  const batch = useRef<Batch>(emptyBatch());
  const [view, setView] = useState<Batch>(emptyBatch);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    pending.current = null;
    const targets = props.open ? latest.current.nodes.map(node => ({ ...node })) : [];
    batch.current = { ...emptyBatch(), targets, directory: targets.some(node => node.type === 'directory') };
    setView(batch.current); setBusy(false);
  }, [props.open, location.key]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current = null; };
  }, []);

  const confirm = async () => {
    if (pending.current || batch.current.targets.length === 0) return;
    const request = Symbol(), key = location.key, original = batch.current;
    pending.current = request; setBusy(true);
    const isCurrent = () => mounted.current && latest.current.open && latest.current.key === key && pending.current === request;
    try {
      const result = await deleteNodes(original.targets);
      // Reconcile data with the currently mounted page even if the old dialog
      // was dismissed. Only the matching request may toast or navigate history.
      if (mounted.current) latest.current.onResult([...result.deleted, ...result.changed].map(node => node.id));
      if (!isCurrent()) return;
      const next = { ...original, targets: result.failed, deleted: original.deleted + result.deleted.length,
        changed: original.changed + result.changed.length, failed: result.failed.length,
        directory: result.failed.some(node => node.type === 'directory') };
      batch.current = next; setView(next);
      if (next.targets.length === 0 && next.changed === 0) {
        latest.current.showToast(`${s.toast_deleted_prefix}${next.deleted}${s.toast_deleted_suffix}`);
        latest.current.onSuccess();
      }
    } catch {
      if (isCurrent()) { batch.current = { ...original, failed: original.targets.length }; setView(batch.current); }
    } finally {
      if (pending.current === request) { pending.current = null; if (mounted.current) setBusy(false); }
    }
  };

  const summary = (template: string) => template.replace('${deleted}', String(view.deleted))
    .replace('${failed}', String(view.failed)).replace('${changed}', String(view.changed));
  const error = view.changed > 0 ? summary(s.delete_changed_summary) : view.failed > 0 ? summary(s.delete_failed_summary) : '';
  return <ConfirmDialog open={props.open} onClose={props.onClose} title={s.delete_title}
    message={busy ? s.delete_in_progress : s.delete_confirm_selected.replace('${count}', String(view.targets.length)) + (view.directory ? ` ${s.delete_confirm_folder}` : '')}
    error={error} busy={busy} confirmDisabled={busy || view.targets.length === 0}
    onConfirm={() => { void confirm(); }} confirmText={s.delete_title}
    cancelText={busy ? s.delete_dismiss : s.dialog_cancel} isDestructive />;
}
