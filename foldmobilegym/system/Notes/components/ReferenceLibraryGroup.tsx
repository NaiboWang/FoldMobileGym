import React, { useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityId } from '../../../os/ActivityContext';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcGroupChevron } from '../res/icons';

/** Presentation-only disclosure: hidden cards keep their identities and records. */
export function ReferenceLibraryGroup({ label, pinned, children }: { label: string; pinned: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const activityId = useActivityId();
  const location = useLocation();
  const currentVisit = useRef(location.key);
  currentVisit.current = location.key;
  const { bindTap } = useNotesGestures();
  const s = useAppStrings(strings, stringsEn);
  const toggle = () => {
    const control = button.current;
    const state = window.__OS__?.getState();
    const top = state?.tasks.find(task => task.taskId === state.activeTaskId)?.stack.at(-1);
    // Reject covered, folded-away, inert and retained previous-visit callbacks.
    if (!control?.isConnected || !control.checkVisibility() || control.closest('[inert]')
      || currentVisit.current !== location.key || !state || state.isLauncherVisible
      || state.isRecentsVisible || top?.activityId !== activityId) return;
    setExpanded(value => !value);
  };
  if (!pinned) return <><h2>{label}</h2>{children}</>;
  return <>
    <h2><button ref={button} type="button" className="notes-reference-group-toggle"
      data-keep-keyboard="true" aria-expanded={expanded} aria-controls={contentId}
      aria-label={expanded ? s.library_collapse_pinned : s.library_expand_pinned}
      onPointerDown={event => event.preventDefault()}
      {...bindTap({ kind: 'action', id: 'notes.editor.library.pinned.toggle' }, { onTrigger: toggle })}>
      {label}<IcGroupChevron size={18} aria-hidden="true" className={expanded ? 'is-expanded' : ''} />
    </button></h2>
    <div id={contentId} hidden={!expanded}>{children}</div>
  </>;
}
