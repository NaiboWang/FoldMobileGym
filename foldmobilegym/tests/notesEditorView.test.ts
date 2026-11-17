import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isFullNoteEditor, adoptedNoteEditorUrl } from '../system/Notes/editorView';
import { noteEditorBackFallback, NOTE_EDITOR_SHEETS } from '../system/Notes/editorOverlay';
import { NAVIGATION_DECLARATION } from '../system/Notes/navigation.declaration';
describe('Notes explicit editor view', () => {
  it('recognizes only an actual note route with the exact single full dimension', () => {
    expect(isFullNoteEditor('/note/owned','?view=full')).toBe(true);
    expect(isFullNoteEditor('/note/new','?view=full&sheet=folder')).toBe(true);
    for(const route of ['/','/folders','/note/a/b'])expect(isFullNoteEditor(route,'?view=full')).toBe(false);
    for(const search of ['','?view=unknown','?view=Full','?view=full&view=parallel'])expect(isFullNoteEditor('/note/owned',search)).toBe(false);
  });
  it('preserves layout across new-ID adoption without carrying an overlay or foreign query', () => {
    expect(adoptedNoteEditorUrl('owned','/note/new','?view=full&sheet=folder&foreign=secret')).toBe('/note/owned?view=full');
    expect(adoptedNoteEditorUrl('owned','/note/new','?sheet=folder')).toBe('/note/owned');
    expect(adoptedNoteEditorUrl('a/b','/note/new','?view=full')).toBe('/note/a%2Fb?view=full');
  });
  it('does not consume a parallel parent when dismissing a cold full-view sheet', () => {
    expect(noteEditorBackFallback('/note/owned','?view=full&sheet=folder',{pathname:'/note/owned',search:''})).toBe('/note/owned?view=full');
    expect(noteEditorBackFallback('/note/owned','?view=full&sheet=folder',{pathname:'/note/owned',search:'?view=full'})).toBeNull();
    expect(noteEditorBackFallback('/note/owned','?view=full&sheet=folder')).toBe('/note/owned?view=full');
  });
  it('preserves view on every modal transition, while leaving exit/new-source targets explicit', () => {
    for(const id of ['notes.editor.menu.open','notes.editor.folder.open','notes.editor.menu.folder.open','notes.editor.reminder.open','notes.editor.delete.open','notes.editor.permanentDelete.open','notes.editor.menu.permanentDelete.open']){
      expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id===id)).toMatchObject({preserveParams:['view']});
    }
    for(const id of ['note.new','notes.editor.rail.note.new'])expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id===id)).toMatchObject({search:{view:'full'}});
    for(const id of ['home.open','notes.editor.delete.confirm','notes.editor.permanentDelete.confirm'])expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id===id)).toMatchObject({search:{}});
  });
  it('mirrors editor actions while declaring the visible-library disclosure only in parallel view', () => {
    const route=NAVIGATION_DECLARATION.routes.find(r=>r.path==='/note/:id')!;
    const base=route.uiStates.filter(s=>!('view' in s.search)&&!('sheet' in s.search&&s.search.sheet==='create'));
    const full=route.uiStates.filter(s=>'view' in s.search);
    expect(base).toHaveLength(NOTE_EDITOR_SHEETS.length+1);expect(full).toHaveLength(base.length);
    const libraryAction='notes.editor.library.pinned.toggle';
    for(let i=0;i<base.length;i++){
      expect(full[i].id).toBe(base[i].id.replace('notes.','notes.focus.'));
      expect(full[i].search).toEqual({...base[i].search,view:'full'});
      const actions='actions' in base[i]?base[i].actions:[];
      const focusedActions='actions' in full[i]?full[i].actions:[];
      expect(focusedActions).toEqual(actions.filter(a=>a.id!==libraryAction).map(a=>({...a,id:a.id.replace('notes.','notes.focus.')})));
      expect(actions.filter(a=>a.id===libraryAction)).toEqual(i===0?[{id:libraryAction,label:'Expand or collapse actual pinned source cards',behavior:'toggle'}]:[]);
    }
    const ids=route.uiStates.flatMap(s=>'actions' in s?s.actions.map(a=>a.id):[]);
    // Preserve every shipped editor action; do not invent a full-view hidden-library action.
    const legacyIds=["notes.editor.undo", "notes.editor.redo", "notes.editor.title.input", "notes.editor.content.input", "notes.checklist.enable", "notes.checklist.input", "notes.checklist.toggle", "notes.checklist.remove", "notes.editor.image.pick", "notes.editor.image.item.open", "notes.editor.image.item.remove", "notes.editor.restore.submit", "notes.editor.menu.restore.submit", "notes.editor.menu.unprivate.submit", "notes.editor.folder.item.submit", "notes.editor.reminder.save.submit", "notes.editor.reminder.enabled.toggle", "notes.editor.reminder.day.input", "notes.editor.reminder.hour.input", "notes.editor.reminder.minute.input", "notes.focus.editor.undo", "notes.focus.editor.redo", "notes.focus.editor.title.input", "notes.focus.editor.content.input", "notes.focus.checklist.enable", "notes.focus.checklist.input", "notes.focus.checklist.toggle", "notes.focus.checklist.remove", "notes.focus.editor.image.pick", "notes.focus.editor.image.item.open", "notes.focus.editor.image.item.remove", "notes.focus.editor.restore.submit", "notes.focus.editor.menu.restore.submit", "notes.focus.editor.menu.unprivate.submit", "notes.focus.editor.folder.item.submit", "notes.focus.editor.reminder.save.submit", "notes.focus.editor.reminder.enabled.toggle", "notes.focus.editor.reminder.day.input", "notes.focus.editor.reminder.hour.input", "notes.focus.editor.reminder.minute.input"];
    const shares=['notes.editor.share','notes.focus.editor.share'];
    const searchActions=['notes.editor.search.input','notes.editor.search.clear','notes.editor.search.previous','notes.editor.search.next','notes.focus.editor.search.input','notes.focus.editor.search.clear','notes.focus.editor.search.previous','notes.focus.editor.search.next'];
    expect(ids.filter(id=>!shares.includes(id)&&!searchActions.includes(id)&&id!==libraryAction&&id!=='notes.editor.import.choose')).toEqual(legacyIds);
    expect(ids.filter(id=>shares.includes(id))).toEqual(shares);
    expect(ids.filter(id=>id===libraryAction)).toEqual([libraryAction]);
    expect(ids.filter(id=>searchActions.includes(id))).toEqual(searchActions);
    expect(ids.filter(id=>id==='notes.editor.import.choose')).toEqual(['notes.editor.import.choose']);
    expect(ids).toHaveLength(legacyIds.length+shares.length+2+searchActions.length);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('ships reachable full-view sheet edges rather than only correct runtime preservation', () => {
    const graph=JSON.parse(readFileSync(new URL('../public/notes_nav_graph.json',import.meta.url),'utf8'));
    const reachable=new Set<string>(['/']);let changed=true;
    while(changed){changed=false;for(const edge of graph.edges)if(reachable.has(edge.sourceNodeId)&&!reachable.has(edge.targetNodeId)){reachable.add(edge.targetNodeId);changed=true;}}
    for(const sheet of NOTE_EDITOR_SHEETS){
      const node=graph.nodes.find((n:{id:string})=>{const u=new URL(n.id,'http://simulator.local');return u.pathname==='/note/:id'&&u.searchParams.get('view')==='full'&&u.searchParams.get('sheet')===sheet;});
      expect(node).toBeDefined();expect(reachable.has(node.id)).toBe(true);
    }
    for(const id of ['notes.editor.menu.open','notes.editor.folder.open','notes.editor.menu.folder.open','notes.editor.reminder.open','notes.editor.delete.open','notes.editor.permanentDelete.open','notes.editor.menu.permanentDelete.open']){
      const edges=graph.edges.filter((e:{id:string;sourceNodeId:string})=>e.id===id&&new URL(e.sourceNodeId,'http://simulator.local').searchParams.get('view')==='full');
      expect(edges.length).toBeGreaterThan(0);for(const edge of edges)expect(new URL(edge.targetNodeId,'http://simulator.local').searchParams.get('view')).toBe('full');
    }
  });
  it('does not add artificial history entries when toggling the same note layout', () => {
    for(const id of ['notes.editor.view.full.open','notes.editor.view.parallel.open'])expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id===id)).toMatchObject({mode:'replace',to:'/note/:id'});
  });
});
