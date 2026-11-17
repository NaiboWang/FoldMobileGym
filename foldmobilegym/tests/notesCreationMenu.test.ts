import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Notes/navigation.declaration';
import { isNoteCreationMenu, noteCreationHomeBackFallback } from '../system/Notes/creationMenu';
import { noteEditorBackFallback } from '../system/Notes/editorOverlay';
import { readFileSync } from 'node:fs';
describe('Native type choice is an owned intermediate state, not a fabricated note',()=>{
  it('supports Home and the actually visible parallel source rail, not an invisible full-view shortcut',()=>{
    expect(isNoteCreationMenu('/','?sheet=create')).toBe(true);
    expect(isNoteCreationMenu('/note/owned','?sheet=create')).toBe(true);
    for(const [path,query]of [['/folders','?sheet=create'],['/note/owned','?view=full&sheet=create'],['/','?sheet=unknown']])expect(isNoteCreationMenu(path,query)).toBe(false);
    const route=NAVIGATION_DECLARATION.routes.find(r=>r.path==='/note/:id')!;
    expect(route.uiStates.filter(s=>'sheet'in s.search&&s.search.sheet==='create').map(s=>s.search)).toEqual([{sheet:'create'}]);
    expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id==='notes.editor.create.open')).toMatchObject({from:{path:'/note/:id',search:{sheet:null,view:null}},mode:'push'});
  });
  it('reconstructs cold Home/editor parents without destroying a task or inserting extra Back entries',()=>{
    expect(noteCreationHomeBackFallback('/','?sheet=create')).toBe('/');
    expect(noteCreationHomeBackFallback('/','?sheet=create',{pathname:'/',search:''})).toBeNull();
    expect(noteEditorBackFallback('/note/owned','?sheet=create')).toBe('/note/owned');
    for(const id of ['note.new','notes.editor.rail.note.new','notes.list.import.open','notes.editor.import.open'])expect(NAVIGATION_DECLARATION.transitions.find(t=>t.id===id)).toMatchObject({mode:'replace',to:'/note/:id',search:{view:'full'}});
  });
  it('keeps both creation origins reachable in the shipped graph',()=>{
    const graph=JSON.parse(readFileSync(new URL('../public/notes_nav_graph.json',import.meta.url),'utf8'));
    const reached=new Set(['/']);let changed=true;while(changed){changed=false;for(const edge of graph.edges)if(reached.has(edge.sourceNodeId)&&!reached.has(edge.targetNodeId)){reached.add(edge.targetNodeId);changed=true;}}
    for(const node of graph.nodes.filter((n:{id:string})=>new URL(n.id,'http://simulator.local').searchParams.get('sheet')==='create'))expect(reached.has(node.id)).toBe(true);
    expect(graph.nodes.filter((n:{id:string})=>new URL(n.id,'http://simulator.local').searchParams.get('sheet')==='create')).toHaveLength(2);
  });
});
