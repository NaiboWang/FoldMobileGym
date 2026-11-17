import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as FileSystem from '../../../os/FileSystemService';
import type { FSNode } from '../../../os/types';
import { useActivityContext } from '../../../os/ActivityContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';
import { documentReference, matchesDocumentMime, matchesDocumentReference } from '../../../os/utils/documentReference';
import { normalizeTransferPath, TRANSFER_ROOT_PATH } from '../utils/transferPath';
import type { TransitionId } from '../navigation.declaration';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { IcNavBack, IcFolder, IcFile, IcList } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export const DocumentPickerPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const [search] = useSearchParams();
  const path = normalizeTransferPath(search.get('path'));
  const { activityId } = useActivityContext();
  const { go, bindBack } = useFileManagerGestures();
  const { bindTap } = useTriggerGestures<TransitionId>({ execute: (id, params) => go(id, params) });
  const [query, setQuery] = useState(''), [revision, setRevision] = useState(0), [error, setError] = useState(false);
  const finished = useRef(false), list = useRef<HTMLDivElement>(null);
  const payload = window.__OS__?.getIntentPayload(activityId);
  const requestedType = payload?.type || '*/*';
  const requestingActivity = () => {
    const state = window.__OS__?.getState();
    const task = state?.tasks.find(item => item.taskId === state.activeTaskId);
    const top = task?.stack.at(-1);
    return top?.activityId === activityId && top.requestCode != null
      && (top.intent?.action === 'ACTION_OPEN_DOCUMENT' || top.intent?.action === 'ACTION_GET_CONTENT');
  };
  const hasRequest = requestingActivity();
  const items = useMemo(() => {
    const needle = query.normalize('NFKC').trim().toLowerCase();
    const nodes = needle ? FileSystem.searchFiles('', { type: 'file' }).filter(node => node.path.startsWith(path + '/')) : FileSystem.listDirectory(path);
    return nodes.filter(node => node.type === 'directory' || (matchesDocumentMime(node, requestedType)
      && node.name.normalize('NFKC').toLowerCase().includes(needle)));
  }, [path, query, revision, requestedType]);
  const directories = useMemo(() => FileSystem.listDirectory(TRANSFER_ROOT_PATH).filter(node => node.type === 'directory'), [revision]);
  useEffect(() => { setQuery(''); setError(false); if (list.current) list.current.scrollTop = 0; }, [path]);
  const choose = (node: FSNode) => {
    if (finished.current || !requestingActivity()) return;
    const reference = documentReference(node), current = FileSystem.getNode(node.path);
    if (!reference || !matchesDocumentReference(reference, current) || !matchesDocumentMime(current, requestedType)) {
      setError(true); setRevision(value => value + 1); return;
    }
    finished.current = true;
    window.__OS__?.keyboard.hide();
    window.__OS__?.setResult({ resultCode: 'OK', data: { document: reference } });
  };
  return (
    <div className="document-picker" data-document-picker data-keep-keyboard="true" data-status-bar-foreground="dark">
      <header>
        <button aria-label={s.document_picker_back} {...bindBack()}><IcNavBack size={24} /></button>
        <h1>{s.document_picker_title}</h1>
        <button aria-label={s.document_picker_refresh} {...bindTap({ kind: 'action', id: 'documentPicker.files.refresh' }, { onTrigger: () => { setRevision(value => value + 1); setError(false); } })}><IcList size={22} /></button>
      </header>
      <p>{s.document_picker_hint}</p>
      <p data-document-picker-path>{path}</p>
      {!hasRequest && <p role="status">{s.document_picker_no_request}</p>}
      {error && <p role="alert">{s.document_picker_stale}</p>}
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={s.document_picker_search} aria-label={s.document_picker_search}
        data-action="documentPicker.search.input" data-action-type="input" data-action-params={JSON.stringify({ value: query })} />
      <div className="document-picker-body">
        <nav className="document-picker-directory" data-scroll-container="directory" data-scroll-direction="vertical">
          <button {...bindTap('documentPicker.folder.open', { params: { path: TRANSFER_ROOT_PATH } })}>{s.document_picker_storage}</button>
          {directories.map(node => <button key={node.id} aria-current={node.path === path ? 'page' : undefined}
            {...bindTap('documentPicker.folder.open', { params: { path: node.path } })}>{node.name}</button>)}
        </nav>
        <div ref={list} className="document-picker-list" data-scroll-container="main" data-scroll-direction="vertical">
          {items.map(node => node.type === 'directory'
            ? <button key={node.id} className="document-picker-row" data-document-path={node.path}
                {...bindTap('documentPicker.folder.open', { params: { path: node.path } })}><IcFolder size={24} /><span>{node.name}</span></button>
            : <button key={node.id} className="document-picker-row" data-document-id={node.id} data-document-path={node.path} disabled={!hasRequest}
                {...bindTap({ kind: 'action', id: 'documentPicker.item.pick.submit' }, { params: { id: node.id, path: node.path }, onTrigger: () => choose(node) })}>
                <IcFile size={24} /><span><strong>{node.name}</strong><small>{node.mimeType || 'application/octet-stream'} · {node.size} B</small></span>
              </button>)}
          {items.length === 0 && <p role="status">{s.document_picker_empty}</p>}
        </div>
      </div>
    </div>
  );
};
