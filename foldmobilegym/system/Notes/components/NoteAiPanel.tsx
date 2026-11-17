import React from 'react';
import {
  AlignLeft,
  AudioLines,
  Eraser,
  Feather,
  FilePenLine,
  Languages,
  LayoutPanelTop,
  ListRestart,
  Network,
  Send,
  X,
} from 'lucide-react';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

const readingCards = [
  ['ai_summary', FilePenLine],
  ['ai_recording_minutes', AudioLines],
  ['ai_translate', Languages],
  ['ai_mind_map', Network],
] as const;

const writingCards = [
  ['ai_copywriting', AlignLeft],
  ['ai_polish', Feather],
  ['ai_length', ListRestart],
  ['ai_layout', LayoutPanelTop],
  ['ai_proofread', Eraser],
] as const;

/**
 * Native-observed AI Notes surface. The recording only demonstrates this
 * launcher, not generated results, so feature cards and question input remain
 * deliberately non-interactive instead of fabricating AI behavior.
 */
export function NoteAiPanel({ available }: { available: boolean }) {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack } = useNotesGestures();
  const card = ([key, Icon]: (typeof readingCards)[number] | (typeof writingCards)[number]) => (
    <div key={key} className="notes-ai-card" data-notes-ai-card aria-disabled="true">
      <Icon size={25} strokeWidth={1.9} aria-hidden="true" />
      <span>{s[key]}</span>
    </div>
  );

  return <section
    className="notes-ai-panel"
    data-notes-ai-panel
    data-keep-keyboard
    role="dialog"
    aria-modal="true"
    aria-label={s.ai_title}
    aria-describedby={!available ? 'notes-ai-unavailable' : undefined}
  >
    <header>
      <h2>{s.ai_title}</h2>
      <button className="notes-ai-close" data-notes-ai-close {...bindBack()} aria-label={s.action_close}>
        <X size={25} strokeWidth={2.2} />
      </button>
    </header>
    {!available && <p id="notes-ai-unavailable" className="sr-only" role="status">{s.editor_overlay_unavailable}</p>}
    <div className="notes-ai-scroll" data-scroll-container="overlay" data-scroll-direction="vertical">
      <section aria-labelledby="notes-ai-reading">
        <h3 id="notes-ai-reading">{s.ai_reading}</h3>
        <div className="notes-ai-reading-grid">{readingCards.map(card)}</div>
      </section>
      <section aria-labelledby="notes-ai-writing">
        <h3 id="notes-ai-writing">{s.ai_writing}</h3>
        <div className="notes-ai-writing-grid">{writingCards.map(card)}</div>
      </section>
    </div>
    <div className="notes-ai-question-row">
      <span className="notes-ai-question-mark" aria-hidden="true">✎◉</span>
      <input data-notes-ai-question disabled placeholder={s.ai_question_placeholder} aria-label={s.ai_question_placeholder} />
      <button data-notes-ai-send disabled aria-label={s.ai_send}><Send size={25} fill="currentColor" /></button>
    </div>
  </section>;
}
