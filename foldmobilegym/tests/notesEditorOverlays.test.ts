import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getNoteEditorSheet, noteEditorBackFallback, noteEditorParent, NOTE_EDITOR_SHEETS } from '../system/Notes/editorOverlay';
import { NAVIGATION_DECLARATION } from '../system/Notes/navigation.declaration';
const source = (file: string) => readFileSync(new URL('../system/Notes/'+file,import.meta.url),'utf8');
describe('Notes owned editor overlays',()=>{
  it.each(NOTE_EDITOR_SHEETS)('derives %s from URL rather than local visibility',sheet=>{
    expect(getNoteEditorSheet('/note/owned','?sheet='+sheet)).toBe(sheet);
    expect(getNoteEditorSheet('/note/another','?sheet='+sheet)).toBe(sheet);
    expect(getNoteEditorSheet('/','?sheet='+sheet)).toBeNull();
  });
  it.each(['','?sheet=unknown','?menu=true'])('does not invent a sheet for %s',search=>expect(getNoteEditorSheet('/note/owned',search)).toBeNull());
  it('retains only the non-overlay route dimensions for cold-entry Back',()=>{
    expect(noteEditorParent('/note/owned','?sheet=reminder&custom=value')).toBe('/note/owned?custom=value');
    expect(noteEditorBackFallback('/note/owned','?sheet=reminder')).toBe('/note/owned');
    expect(noteEditorBackFallback('/note/owned','?sheet=folder',{pathname:'/note/owned',search:''})).toBeNull();
    expect(noteEditorBackFallback('/note/owned','?sheet=folder',{pathname:'/note/another',search:''})).toBe('/note/owned');
    expect(noteEditorBackFallback('/note/owned','?sheet=folder',{pathname:'/note/owned',search:'?sheet=menu'})).toBe('/note/owned');
    expect(noteEditorBackFallback('/note/owned','')).toBeNull();
  });
  it('declares all actual sheet destinations and distinct concurrent scroll surfaces',()=>{
    const route=NAVIGATION_DECLARATION.routes.find(route=>route.path==='/note/:id')!;
    for (const full of [false,true]) {
      const states=route.uiStates.filter(state=>('view' in state.search && state.search.view==='full')===full&& !('sheet' in state.search&&state.search.sheet==='create'));
      expect(states.map(state=>'sheet' in state.search?state.search.sheet:null)).toEqual([null,...NOTE_EDITOR_SHEETS]);
    }
    const scrollNames=route.scrollContainers.map(item=>item.name);
    expect(scrollNames).toEqual(['main','master','overlay','reminderDay','reminderHour','reminderMinute','create']);
    expect(new Set(scrollNames).size).toBe(scrollNames.length);
  });
  it('pushes direct opens and replaces the menu when entering a destination',()=>{
    const transitions=NAVIGATION_DECLARATION.transitions;
    for(const id of ['notes.editor.ai.open','notes.editor.menu.open','notes.editor.folder.open','notes.editor.permanentDelete.open'])expect(transitions.find(item=>item.id===id)).toMatchObject({mode:'push',from:[{path:'/note/:id',search:{sheet:null}},{path:'/note/:id',search:{view:'full',sheet:null}}]});
    for(const id of ['notes.editor.reminder.open','notes.editor.menu.folder.open','notes.editor.delete.open','notes.editor.menu.permanentDelete.open'])expect(transitions.find(item=>item.id===id)).toMatchObject({mode:'replace',from:[{path:'/note/:id',search:{sheet:'menu'}},{path:'/note/:id',search:{view:'full',sheet:'menu'}}]});
  });
  it('has unique working action identities across editor and modal states',()=>{
    const ids=NAVIGATION_DECLARATION.routes.flatMap(route=>route.uiStates.flatMap(state=>'actions' in state?state.actions.map(action=>action.id):[]));
    expect(new Set(ids).size).toBe(ids.length);expect(ids).toContain('notes.editor.folder.item.submit');expect(ids).toContain('notes.editor.reminder.save.submit');
  });
  it('isolates the entire editor plus the expanded sidebar and leaves the overlay interactive',()=>{
    const page=source('pages/NoteEditorPage.tsx'),layout=source('components/ReferenceEditorLayout.tsx');
    expect(page).toContain('data-notes-editor-background inert={!!sheet}');expect(layout).toContain('inert={!!overlay || focused}');
    expect(page).not.toMatch(/const \[(folderPickerOpen|menuOpen|reminderOpen),/);
    expect(page).not.toContain('window.confirm');expect(page).toContain('owner.current?.note');expect(page).toContain('closedEntry.current === location.key');
    expect(page).toContain('pendingEntry.current = null;');
    expect(page).toContain('publishFields({ folderId: folder.id })');
    expect(source('hooks/useNoteTextHistory.ts')).toContain("element.closest('[inert]')");
  });
  it('uses shared Back and app-contained, scrollable sheets without native confirmation dialogs',()=>{
    const sheet=source('components/EditorSheet.tsx'),reminder=source('components/DateTimeDialog.tsx');
    expect(sheet).toContain('bindBack()');expect(sheet).toContain('role="dialog"');expect(sheet).not.toContain('fixed inset');
    expect(reminder).not.toContain('fixed inset');expect(reminder).not.toContain('onMouseUp');expect(reminder).not.toContain('onTouchEnd');
    expect(reminder).toContain('new ResizeObserver(align)');expect(reminder).toContain('cancelAnimationFrame(raf.current)');
    expect(reminder).toContain('clampReminderSelection(selectedTs, TimeService.now())');
    expect(reminder).toContain("new Intl.DateTimeFormat('en-US'");
    expect(reminder).toContain('tabIndex={-1} role="option"');expect(reminder).toContain('aria-activedescendant=');
  });
  it('keeps the native-observed AI launcher URL-owned without fabricating AI actions',()=>{
    const page=source('pages/NoteEditorPage.tsx'),panel=source('components/NoteAiPanel.tsx'),layout=source('components/ReferenceEditorLayout.tsx');
    expect(page).toContain("sheet === 'ai'");expect(page).toContain("go('notes.editor.ai.open'");expect(layout).toContain("bindTap('notes.editor.ai.open'");
    expect(panel).toContain('data-notes-ai-panel');expect(panel).toContain('bindBack()');expect(panel).toContain('data-notes-ai-question disabled');
    expect(panel).not.toContain('data-action=');expect(panel).not.toContain('onTrigger');
  });
});
