import { describe, expect, it } from 'vitest';
import { judgeSingleApp, singleAppContract, validateSingleAppInitial, type NotesAppendContract } from '../foldagent_single_app_contract';

const c: NotesAppendContract = { version: 1, card: 'SA01', app: 'notes', kind: 'notes_append', target_id: 'original', append_text: 'Bring USB-C.' };
function fixture() {
  const initial: any = { apps: { notes: { notes: [
    { id: 'original', title: 'Review', content: 'Original\nKeep.', updatedAt: 1, images: [{ id: 'image', source: { id: 'asset', path: '/photo.jpg', createdAt: 1 } }] },
    { id: 'other', title: 'Review (old)', content: 'Protected', updatedAt: 1 },
  ], todos: [], settings: { showWordCount: true }, createdCount: 0, deletedCount: 0 } },
  runtime: { active_app_id: 'notes', app_routes: { notes: '/' } } };
  const current = structuredClone(initial);
  current.apps.notes.notes[0].content += '\nBring USB-C.';
  current.apps.notes.notes[0].updatedAt = 2;
  current.runtime.app_routes.notes = '/note/original';
  return { initial, current };
}
describe('SA01 original-identity append and protection contract', () => {
  it('accepts exact single append and normal update timestamp without mutating inputs', () => {
    const { initial, current } = fixture(), original = structuredClone(initial), final = structuredClone(current);
    expect(judgeSingleApp(initial, current, c).passed).toBe(true);
    expect(initial).toEqual(original); expect(current).toEqual(final);
  });
  it('rejects doing nothing', () => { const { initial } = fixture(); expect(judgeSingleApp(initial, initial, c).passed).toBe(false); });
  for (const [name, edit] of Object.entries({
    wrong_target: (s: any) => { s.apps.notes.notes[1].content = s.apps.notes.notes[0].content; s.apps.notes.notes[0].content = 'Original\nKeep.'; },
    double_append: (s: any) => { s.apps.notes.notes[0].content += '\nBring USB-C.'; },
    overwrite_original: (s: any) => { s.apps.notes.notes[0].content = 'Bring USB-C.'; },
    image_replaced: (s: any) => { s.apps.notes.notes[0].images[0].source.id = 'wrong'; },
    renamed: (s: any) => { s.apps.notes.notes[0].title = 'Renamed'; },
    other_edited: (s: any) => { s.apps.notes.notes[1].content += '!'; },
    new_replacement: (s: any) => { s.apps.notes.notes.push({ ...s.apps.notes.notes[0], id: 'replacement' }); },
    deleted_original: (s: any) => { s.apps.notes.notes.shift(); },
    duplicate_identity: (s: any) => { s.apps.notes.notes[1].id = 'original'; },
    changed_setting: (s: any) => { s.apps.notes.settings.showWordCount = false; },
    left_wrong_editor: (s: any) => { s.runtime.app_routes.notes = '/note/other'; },
  })) it(`rejects ${name}`, () => { const { initial, current } = fixture(); edit(current); expect(judgeSingleApp(initial, current, c).passed).toBe(false); });
  it('attributes missing/ambiguous initial identities and already-completed seeds as errors', () => {
    for (const edit of [
      (s: any) => { s.apps.notes.notes.shift(); },
      (s: any) => { s.apps.notes.notes[1].id = 'original'; },
      (s: any) => { s.apps.notes.notes[0].content += c.append_text; },
    ]) { const { initial } = fixture(); edit(initial); expect(() => validateSingleAppInitial(initial, c)).toThrow(); }
  });
  it('requires the explicit supported version and single app, leaving legacy contracts alone', () => {
    expect(singleAppContract({ apps: ['notes'] })).toBeNull();
    expect(singleAppContract({ apps: ['notes'], seed_contract: { single_app_v1: c } })).toEqual(c);
    for (const task of [
      { apps: ['notes', 'wechat'], seed_contract: { single_app_v1: c } },
      { apps: ['notes'], seed_contract: { single_app_v1: { ...c, version: 99 } } },
      { apps: ['notes'], seed_contract: { single_app_v1: c, workflow_v1: {} } },
    ]) expect(() => singleAppContract(task)).toThrow();
  });
  it('rejects a locked original at initialization instead of blaming the agent', () => {
    const { initial } = fixture(); initial.apps.notes.notes[0].locked = true;
    expect(() => validateSingleAppInitial(initial, c)).toThrow();
  });
  it('recognizes zero as a valid trash timestamp just like the app does', () => {
    const { initial } = fixture(); initial.apps.notes.notes[0].trashedAt = 0;
    expect(() => validateSingleAppInitial(initial, c)).toThrow();
  });
});
