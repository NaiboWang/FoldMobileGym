import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { IcFindClear, IcFindNext, IcFindPrevious } from '../res/icons';
import { EditorSheet } from './EditorSheet';
import { findNoteText, nextNoteTextMatch, type NoteSearchDocument } from '../textSearch';

/** Read-only find surface: never writes into the editor or its undo history. */
export function NoteTextSearch({ documents, focused, available, active }: {
  documents: NoteSearchDocument[]; focused: boolean; available: boolean; active: () => boolean;
}) {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap } = useNotesGestures();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null), root = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => available ? findNoteText(documents, query) : [], [documents, query, available]);
  const current = matches.length ? Math.min(index, matches.length - 1) : 0;
  // Mount-only autofocus, never refocus after a fold, keyboard Back or task return.
  const mountOwner = useRef(active);
  useLayoutEffect(() => { if (mountOwner.current()) input.current?.focus(); }, []);
  useLayoutEffect(() => {
    const target = root.current?.querySelector('[data-notes-search-current="true"]');
    const scroll = target?.closest<HTMLElement>('[data-scroll-container="overlay"]');
    if (!target || !scroll) return;
    const rect = target.getBoundingClientRect(), bounds = scroll.getBoundingClientRect();
    const toolbar = root.current?.querySelector('.notes-find-controls')?.getBoundingClientRect().height ?? 0;
    if (rect.top < bounds.top + toolbar) scroll.scrollTop += rect.top - bounds.top - toolbar;
    else if (rect.bottom > bounds.bottom) scroll.scrollTop += rect.bottom - bounds.bottom;
  }, [current, matches]);
  const move = (direction: -1 | 1) => { if (available && active()) setIndex(nextNoteTextMatch(current, direction, matches.length)); };
  return <EditorSheet kind="search" title={s.editor_find}>
    <div ref={root} className="notes-find">
      <div className="notes-find-controls bg-app-surface">
        <input ref={input} type="search" aria-label={s.editor_find} placeholder={s.editor_find_placeholder}
          value={query} disabled={!available}
          data-action={focused ? 'notes.focus.editor.search.input' : 'notes.editor.search.input'} data-action-type="input" data-action-params={JSON.stringify({ value: query })}
          onChange={event => { if (!available || !active()) return; setQuery(event.currentTarget.value); setIndex(0); }} />
        <div className="notes-find-navigation">
          <span role="status" aria-live="polite" data-notes-search-count>{matches.length ? `${current + 1} / ${matches.length}` : query ? s.editor_find_none : s.editor_find_empty}</span>
          <button type="button" disabled={!available || !query} aria-label={s.editor_find_clear}
            {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.search.clear' } : { kind: 'action', id: 'notes.editor.search.clear' }, { onTrigger: () => { if (available && active()) { setQuery(''); setIndex(0); } } })}><IcFindClear size={20} /></button>
          <button type="button" disabled={!available || !matches.length} aria-label={s.editor_find_previous}
            {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.search.previous' } : { kind: 'action', id: 'notes.editor.search.previous' }, { onTrigger: () => move(-1) })}><IcFindPrevious size={20} /></button>
          <button type="button" disabled={!available || !matches.length} aria-label={s.editor_find_next}
            {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.search.next' } : { kind: 'action', id: 'notes.editor.search.next' }, { onTrigger: () => move(1) })}><IcFindNext size={20} /></button>
        </div>
      </div>
      {!available ? <p role="status">{s.editor_overlay_unavailable}</p> : documents.map(document => {
        const parts: React.ReactNode[] = []; let cursor = 0;
        matches.forEach((match, matchIndex) => {
          if (match.documentId !== document.id) return;
          parts.push(document.text.slice(cursor, match.start));
          parts.push(<mark key={match.start} data-notes-search-current={matchIndex === current ? 'true' : undefined}>{document.text.slice(match.start, match.end)}</mark>);
          cursor = match.end;
        });
        parts.push(document.text.slice(cursor));
        return <p key={document.id} data-notes-search-document={document.id}>{parts}</p>;
      })}
    </div>
  </EditorSheet>;
}
