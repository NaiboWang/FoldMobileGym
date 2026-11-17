import { describe, expect, it } from 'vitest';
import { captureFavoriteSelection, favoriteSelectionIsCurrent } from '../apps/Bilibili/utils/favoriteSelection';
const source = () => ({ uid: 'local-user', favoritesFolders: [
  { id: 'folder-a', title: 'First', videoIds: ['video-one', 'other-video'] },
  { id: 'folder-b', title: 'Second', videoIds: ['other-video'] },
  { id: 'folder-c', title: 'Third', videoIds: ['video-one'] },
] });
describe('Bilibili favorite selection source', () => {
  it('initializes actual memberships without changing source data', () => {
    const user = source(), before = JSON.stringify(user);
    const selection = captureFavoriteSelection(user, 'video-one');
    expect([...selection.selectedIds]).toEqual(['folder-a', 'folder-c']);
    expect(favoriteSelectionIsCurrent(user, 'video-one', selection)).toBe(true);
    expect(JSON.stringify(user)).toBe(before);
  });
  it('adds a valid newly created folder without clearing original memberships', () => {
    const user = source();
    expect([...captureFavoriteSelection(user, 'video-one', 'folder-b').selectedIds]).toEqual(['folder-a', 'folder-c', 'folder-b']);
    expect([...captureFavoriteSelection(user, 'video-one', 'absent').selectedIds]).toEqual(['folder-a', 'folder-c']);
  });
  it('permits an intentional empty selection but not a nonexistent target', () => {
    const user = source(), selection = captureFavoriteSelection(user, 'video-one');
    expect(favoriteSelectionIsCurrent(user, 'video-one', { ...selection, selectedIds: new Set() })).toBe(true);
    expect(favoriteSelectionIsCurrent(user, 'video-one', { ...selection, selectedIds: new Set(['absent']) })).toBe(false);
  });
  it('rejects another video or supplied account identity', () => {
    const user = source(), selection = captureFavoriteSelection(user, 'video-one');
    expect(favoriteSelectionIsCurrent(user, 'video-two', selection)).toBe(false);
    expect(favoriteSelectionIsCurrent({ ...user, uid: 'another-user' }, 'video-one', selection)).toBe(false);
  });
  it.each(['id', 'title', 'videoIds'] as const)('rejects replaced folder %s facts without clearing the pending choices', field => {
    const user = source(), selection = captureFavoriteSelection(user, 'video-one');
    const changed = { ...user, favoritesFolders: user.favoritesFolders.map((folder, index) => index ? folder : { ...folder, [field]: field === 'videoIds' ? ['new-video'] : 'changed' }) };
    expect(favoriteSelectionIsCurrent(changed, 'video-one', selection)).toBe(false);
    expect([...selection.selectedIds]).toEqual(['folder-a', 'folder-c']);
  });
  it('rejects removed folders and duplicate identities instead of choosing a source', () => {
    const user = source(), selection = captureFavoriteSelection(user, 'video-one');
    expect(favoriteSelectionIsCurrent({ ...user, favoritesFolders: user.favoritesFolders.slice(1) }, 'video-one', selection)).toBe(false);
    const duplicate = { ...user, favoritesFolders: [...user.favoritesFolders, { ...user.favoritesFolders[0] }] };
    expect(captureFavoriteSelection(duplicate, 'video-one').sourceKey).toBeNull();
    expect(favoriteSelectionIsCurrent(duplicate, 'video-one', selection)).toBe(false);
  });
  it('detects an in-place source mutation, not just reference replacement', () => {
    const user = source(), selection = captureFavoriteSelection(user, 'video-one');
    user.favoritesFolders[0].videoIds.push('new-video');
    expect(favoriteSelectionIsCurrent(user, 'video-one', selection)).toBe(false);
  });
  it('supports empty/legacy collections without inventing a folder or actor', () => {
    const selection = captureFavoriteSelection({}, 'video-one');
    expect(selection.selectedIds.size).toBe(0);
    expect(favoriteSelectionIsCurrent({}, 'video-one', selection)).toBe(true);
    expect(captureFavoriteSelection({}, '').sourceKey).toBeNull();
  });
});
