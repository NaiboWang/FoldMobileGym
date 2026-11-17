import { describe, expect, it } from 'vitest';
import { judgeSingleApp, singleAppContract, type NotesAppendContract } from '../foldagent_single_app_contract';

const marker = { version: 2, card: 'SA01', app: 'notes', kind: 'notes_append', target_id: 'original', append_text: 'Bring USB-C.' };
function scenario(original: string, actual: string) {
  const initial: any = { apps: { notes: { notes: [
    { id: 'original', title: 'Review', content: original, updatedAt: 1, images: [{ id: 'protected-image' }] },
    { id: 'other', title: 'Review (old)', content: 'Protected', updatedAt: 1 },
  ], createdCount: 0, deletedCount: 0, settings: { showWordCount: true } } }, runtime: { active_app_id: 'notes', app_routes: { notes: '/' } } };
  const current = structuredClone(initial);
  current.apps.notes.notes[0].content = actual;
  current.runtime.app_routes.notes = '/note/original';
  return { initial, current };
}
const judge = (old: string, actual: string) => {
  const { initial, current } = scenario(old, actual);
  return judgeSingleApp(initial, current, marker as NotesAppendContract);
};

describe('versioned SA01 line-boundary semantics, user-authorized 2026-10-26', () => {
  it('admits version2 explicitly and keeps unknown versions rejected', () => {
    expect(singleAppContract({ apps: ['notes'], seed_contract: { single_app_v1: marker } })).toEqual(marker);
    expect(() => singleAppContract({ apps: ['notes'], seed_contract: { single_app_v1: { ...marker, version: 99 } } })).toThrow();
  });
  for (const original of ['Keep.', 'Keep.\n', 'Keep.\n\n']) {
    const minimal = original + (original.endsWith('\n') ? '' : '\n') + marker.append_text;
    for (const terminal of ['', '\n']) it(`accepts exact prefix and whole appended line: ${JSON.stringify({ original, terminal })}`, () => {
      expect(judge(original, minimal + terminal).passed).toBe(true);
    });
    it(`also accepts the former literal separator without rewriting original whitespace: ${JSON.stringify(original)}`, () => {
      expect(judge(original, original + '\n' + marker.append_text).passed).toBe(true);
    });
  }
  it('does not reinterpret any historical version1 outcome', () => {
    const { initial, current } = scenario('Keep.\n', 'Keep.\nBring USB-C.\n');
    expect(judgeSingleApp(initial, current, { ...marker, version: 1 } as NotesAppendContract).passed).toBe(false);
  });
  for (const [name, old, actual] of [
    ['missing line boundary', 'Keep.', 'Keep.Bring USB-C.'],
    ['original punctuation moved', 'Keep.', 'Keep\nBring USB-C..'],
    ['original newline removed', 'Keep.\n', 'Keep.Bring USB-C.'],
    ['original blank line removed', 'Keep.\n\n', 'Keep.\nBring USB-C.'],
    ['double append', 'Keep.', 'Keep.\nBring USB-C.\nBring USB-C.'],
    ['changed fact', 'Keep.', 'Keep.\nBring USB-A.'],
    ['added spaces', 'Keep.', 'Keep.\n Bring USB-C.'],
    ['extra trailing text', 'Keep.', 'Keep.\nBring USB-C. done'],
    ['unbounded trailing whitespace', 'Keep.', 'Keep.\nBring USB-C.\n\n'],
  ]) it(`rejects ${name}`, () => { expect(judge(old, actual).passed).toBe(false); });
  for (const [name, mutation] of Object.entries({
    other_note: (s: any) => { s.apps.notes.notes[1].content += '!'; },
    title: (s: any) => { s.apps.notes.notes[0].title = 'Changed'; },
    image: (s: any) => { s.apps.notes.notes[0].images = []; },
    new_note: (s: any) => { s.apps.notes.notes.push({ id: 'replacement', title: 'Review', content: 'Keep.\nBring USB-C.' }); },
    wrong_editor: (s: any) => { s.runtime.app_routes.notes = '/note/other'; },
  })) it(`still rejects ${name}`, () => {
    const { initial, current } = scenario('Keep.\n', 'Keep.\nBring USB-C.\n'); mutation(current);
    expect(judgeSingleApp(initial, current, marker as NotesAppendContract).passed).toBe(false);
  });
});
