import React from 'react';
import {
  AlignLeft,
  AudioLines,
  Bold,
  CheckCircle2,
  CirclePlus,
  Image,
  Italic,
  Palette,
  Sparkles,
  Strikethrough,
  Type,
  Underline,
} from 'lucide-react';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

type Props = {
  noteId: string;
  keyboardVisible: boolean;
  bottomInset: number;
  focused: boolean;
  aiBlocked: boolean;
  editBlocked: boolean;
  checklistEnabled: boolean;
  onAi: () => void;
  onChecklist: () => void;
  onImage: () => void;
};

const toolClass = 'notes-format-tool';

/**
 * Native-observed Notes toolbar. Unsupported rich-text affordances are visual,
 * disabled controls: they do not write plain-text markup or expose fake actions.
 */
export function NoteFormattingToolbar({
  noteId,
  keyboardVisible,
  bottomInset,
  focused,
  aiBlocked,
  editBlocked,
  checklistEnabled,
  onAi,
  onChecklist,
  onImage,
}: Props) {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap } = useNotesGestures();
  const unavailable = (tool: string, label: string, icon: React.ReactNode) => <button
    key={tool}
    type="button"
    className={toolClass}
    data-notes-tool={tool}
    disabled
    aria-label={label}
  >{icon}</button>;

  const ai = <button
    type="button"
    className={`${toolClass} notes-format-ai`}
    data-notes-tool="ai"
    disabled={aiBlocked}
    onPointerDown={event => event.preventDefault()}
    {...bindTap('notes.editor.ai.open', { params: { id: noteId }, onTrigger: onAi })}
    aria-label={s.ai_title}
  ><Sparkles size={21} /></button>;
  const checklist = <button
    type="button"
    className={toolClass}
    data-notes-tool="checklist"
    disabled={editBlocked}
    onPointerDown={event => event.preventDefault()}
    {...bindTap(focused ? { kind: 'action', id: 'notes.focus.checklist.enable' } : { kind: 'action', id: 'notes.checklist.enable' }, { onTrigger: onChecklist })}
    aria-label={s.toolbar_checklist}
    aria-pressed={checklistEnabled}
  ><CheckCircle2 size={21} className={checklistEnabled ? 'text-app-primary' : undefined} /></button>;
  const image = <button
    type="button"
    className={toolClass}
    data-notes-tool="image"
    disabled={editBlocked}
    onPointerDown={event => event.preventDefault()}
    {...bindTap(focused ? { kind: 'action', id: 'notes.focus.editor.image.pick' } : { kind: 'action', id: 'notes.editor.image.pick' }, { onTrigger: onImage })}
    aria-label={s.toolbar_image}
  ><Image size={21} /></button>;

  return <div
    className="notes-format-toolbar shrink-0 relative z-30 bg-app-surface"
    data-notes-format-toolbar
    data-keep-keyboard
    data-keyboard-visible={keyboardVisible ? 'true' : 'false'}
    style={{ height: keyboardVisible ? 48 : 56 + bottomInset }}
  >
    <div className="notes-format-row" data-notes-format-row style={{ height: keyboardVisible ? 48 : 56 + bottomInset, paddingBottom: keyboardVisible ? 0 : bottomInset }}>
      {ai}
      {unavailable('style', s.toolbar_text_style, <Type size={20} />)}
      {keyboardVisible && <>
        {unavailable('bold', s.toolbar_bold, <Bold size={19} />)}
        {unavailable('italic', s.toolbar_italic, <Italic size={19} />)}
        {unavailable('underline', s.toolbar_underline, <Underline size={19} />)}
        {unavailable('strike', s.toolbar_strike, <Strikethrough size={19} />)}
        {unavailable('font-size', s.toolbar_font_size, <span className="notes-format-font-size">16⌄</span>)}
        {unavailable('color', s.toolbar_color, <Palette size={20} className="notes-format-color" />)}
        {unavailable('paragraph', s.toolbar_paragraph, <AlignLeft size={20} />)}
      </>}
      {checklist}
      {image}
      {unavailable('more', s.toolbar_more, <CirclePlus size={21} />)}
      {unavailable('recording', s.toolbar_recording, <AudioLines size={21} />)}
    </div>
  </div>;
}

