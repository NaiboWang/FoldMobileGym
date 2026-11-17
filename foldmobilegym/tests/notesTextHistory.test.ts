import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTextHistory, type EditorSelection, type EditorText } from '../system/Notes/textHistory';
const range = (start: number, end = start, field: 'title'|'content' = 'content'): EditorSelection => ({field,start,end});
const body = (content: string, title=''): EditorText => ({ title, content });
const record = (h: ReturnType<typeof createTextHistory>, content: string, before: number, after: number, time=0, inputType='insertText', end=before) => h.record(body(content),range(before,end),range(after),{time,inputType});
describe('Notes authored text history', () => {
  it('starts without invented transactions and keeps returned snapshots independent', () => {
    const h=createTextHistory(body('original'));expect(h.canUndo()).toBe(false);expect(h.canRedo()).toBe(false);expect(h.undo()).toBeNull();
    const snapshot=h.getSnapshot();snapshot.content='corrupted';snapshot.selection.start=999;expect(h.getSnapshot().content).toBe('original');expect(h.getSnapshot().selection.start).toBe(0);
  });
  it('groups continuous typing, restores the original cursor and redoes whole text', () => {
    const h=createTextHistory(body(''));record(h,'a',0,1,0);record(h,'ab',1,2,100);record(h,'abc',2,3,200);
    expect(h.undo()).toMatchObject({content:'',selection:range(0)});expect(h.canUndo()).toBe(false);expect(h.redo()).toMatchObject({content:'abc',selection:range(3)});
  });
  it('separates typing after the actual physical pause threshold', () => {
    const h=createTextHistory(body(''));record(h,'a',0,1,0);record(h,'ab',1,2,751);expect(h.undo()?.content).toBe('a');expect(h.undo()?.content).toBe('');
  });
  it('does not merge backwards physical time', () => {
    const h=createTextHistory(body(''));record(h,'a',0,1,100);record(h,'ab',1,2,0);expect(h.undo()?.content).toBe('a');
  });
  it('selection replacement is not merged with prior typing', () => {
    const h=createTextHistory(body(''));record(h,'Alpha',0,5);h.select(range(0,5));record(h,'B',0,1,100,'insertText',5);record(h,'Beta',1,4,200);
    expect(h.undo()).toMatchObject({content:'Alpha',selection:range(0,5)});expect(h.redo()?.content).toBe('Beta');
  });
  it('cursor movement and explicit boundaries keep edits separate', () => {
    const h=createTextHistory(body('abc'));record(h,'abcd',3,4);h.select(range(1));record(h,'axbcd',1,2,10);h.breakGroup();record(h,'axybcd',2,3,20);
    expect(h.undo()?.content).toBe('axbcd');expect(h.undo()?.content).toBe('abcd');
  });
  it('new editing after undo drops only the redo branch', () => {
    const h=createTextHistory(body('A'));record(h,'AB',1,2);h.undo();record(h,'AX',1,2,100);
    expect(h.canRedo()).toBe(false);expect(h.redo()).toBeNull();expect(h.undo()?.content).toBe('A');
  });
  it('does not merge a fresh edit into an entry after redo', () => {
    const h=createTextHistory(body(''));record(h,'a',0,1);h.undo();h.redo();record(h,'ab',1,2,100);expect(h.undo()?.content).toBe('a');
  });
  it('records title and body atomically without undoing unrelated metadata', () => {
    const h=createTextHistory(body('Body','Title'));
    h.record(body('Body','Edited title'),range(0,5,'title'),range(12,12,'title'),{time:0,inputType:'insertFromPaste'});
    h.record(body('Edited body','Edited title'),range(0,4),range(11),{time:1,inputType:'insertFromPaste'});
    expect(h.undo()).toMatchObject({title:'Edited title',content:'Body'});expect(h.undo()).toMatchObject({title:'Title',content:'Body',selection:range(0,5,'title')});
  });
  it('keeps paste/cut/deletion direction as separate operations', () => {
    const h=createTextHistory(body('abc'));record(h,'ab',3,2,0,'deleteContentBackward');record(h,'a',2,1,100,'deleteContentBackward');
    record(h,'a😀中文',1,5,200,'insertFromPaste');expect(h.undo()?.content).toBe('a');expect(h.undo()?.content).toBe('abc');
  });
  it('preserves one complete IME composition despite intermediate replacements', () => {
    const h=createTextHistory(body(''));
    h.record(body('n'),range(0),range(1),{time:0,inputType:'insertCompositionText',composition:1});
    h.record(body('ni'),range(0,1),range(2),{time:1000,inputType:'insertCompositionText',composition:1});
    h.record(body('你'),range(0,2),range(1),{time:2000,inputType:'insertText',composition:1});
    expect(h.undo()?.content).toBe('');expect(h.redo()?.content).toBe('你');expect(h.undo()?.content).toBe('');expect(h.canUndo()).toBe(false);
  });
  it('distinct compositions never merge into each other', () => {
    const h=createTextHistory(body(''));
    h.record(body('你'),range(0),range(1),{time:0,inputType:'insertCompositionText',composition:1});
    h.record(body('你好'),range(1),range(2),{time:100,inputType:'insertCompositionText',composition:2});
    expect(h.undo()?.content).toBe('你');
  });
  it('no-op final composition input does not add a duplicate transaction', () => {
    const h=createTextHistory(body(''));record(h,'你好',0,2);expect(record(h,'你好',2,2,10)).toBe(false);expect(h.undo()?.content).toBe('');expect(h.canUndo()).toBe(false);
  });
  it('reset isolates another note and invalidates both stacks', () => {
    const h=createTextHistory(body('A'));record(h,'AX',1,2);h.undo();h.reset(body('B','Second'));
    expect(h.canUndo()).toBe(false);expect(h.canRedo()).toBe(false);expect(h.getSnapshot()).toMatchObject({title:'Second',content:'B'});
  });
  it('clamps invalid ranges to actual UTF-16 lengths, including emoji', () => {
    const h=createTextHistory(body('😀'));
    h.record(body('😀中'),range(-2,999),range(999,1000),{time:0,inputType:'insertFromPaste'});
    expect(h.undo()?.selection).toEqual(range(0,2));expect(h.redo()?.selection).toEqual(range(3,3));
  });
  it('bounded entries retain recent undo data without truncating authored content', () => {
    const h=createTextHistory(body('A'),{maxEntries:2});record(h,'AB',1,2,0,'insertFromPaste');record(h,'ABC',2,3,1,'insertFromPaste');record(h,'ABCD',3,4,2,'insertFromPaste');
    expect(h.undo()?.content).toBe('ABC');expect(h.undo()?.content).toBe('AB');expect(h.undo()).toBeNull();expect(h.getSnapshot().content).toBe('AB');
  });
  it('character budget keeps the latest reversible edit, even for a long note', () => {
    const h=createTextHistory(body('a'),{maxCharacters:5});record(h,'long text',1,9,0,'insertFromPaste');record(h,'new long text',9,13,1,'insertFromPaste');
    expect(h.undo()?.content).toBe('long text');expect(h.undo()).toBeNull();
  });
  it('wires real controls to synchronous original persistence, not development toasts', () => {
    const page=readFileSync(new URL('../system/Notes/pages/NoteEditorPage.tsx',import.meta.url),'utf8');
    expect(page).not.toContain('showToast(s.toast_undo_dev)');expect(page).not.toContain('showToast(s.toast_redo_dev)');
    expect(page).toContain('persistEditorText(draft, savedNewIdRef.current, addNote');expect(page).toContain('editorPatch(before,next)');expect(page).toContain('updateNote(noteId,patch)');expect(page).toContain('disabled={!editHistory.canUndo || imagePicker.busy}');
    expect(page).toContain("initializedRouteRef.current === 'new' && savedNewIdRef.current === id");
    const hook=readFileSync(new URL('../system/Notes/hooks/useNoteTextHistory.ts',import.meta.url),'utf8');expect(hook).toContain("addEventListener('beforeinput'");expect(hook).toContain('cancelRestore()');expect(hook).not.toContain('localStorage');
  });
});
