import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = (file: string) => readFileSync(new URL('../system/Notes/' + file, import.meta.url), 'utf8');

describe('Notes native-observed formatting toolbar', () => {
  it('keeps only implemented AI, checklist and image controls actionable', () => {
    const toolbar = source('components/NoteFormattingToolbar.tsx');
    expect(toolbar).toContain("bindTap('notes.editor.ai.open'");
    expect(toolbar).toContain("id: 'notes.checklist.enable'");
    expect(toolbar).toContain("id: 'notes.editor.image.pick'");
    expect(toolbar.match(/bindTap\(/g)).toHaveLength(3);
    for (const tool of ['style','bold','italic','underline','strike','font-size','color','paragraph','more','recording']) {
      expect(toolbar).toContain(`unavailable('${tool}'`);
    }
  });

  it('switches the same mounted toolbar between idle and keyboard-rich rows', () => {
    const toolbar = source('components/NoteFormattingToolbar.tsx');
    const page = source('pages/NoteEditorPage.tsx');
    expect(toolbar).toContain('data-keyboard-visible={keyboardVisible');
    expect(toolbar).toContain('{keyboardVisible && <>');
    expect(page).toContain('<NoteFormattingToolbar');
    expect(page).not.toContain('toast_handwrite_dev');
    expect(page).not.toContain('toast_text_style_dev');
  });
});

