import { describe, expect, it } from 'vitest';
import { normalizeTransferPath, parentTransferPath } from '@/system/FileManager/utils/transferPath';
import { NAVIGATION_DECLARATION } from '@/system/FileManager/navigation.declaration';
describe('transfer directory routing', () => {
  it.each([null, undefined, '', '/', '/other', '/sdcard-other/a', 'sdcard/a', '/sdcard/../a', '/sdcard/./a', '/sdcard/a\u0000b'])('bounds invalid path %j to shared storage', value => {
    expect(normalizeTransferPath(value)).toBe('/sdcard');
  });
  it('normalizes separators and keeps literal Unicode/spaces', () => {
    expect(normalizeTransferPath('//sdcard//相册 1//子目录/')).toBe('/sdcard/相册 1/子目录');
  });
  it.each([['/sdcard/a/b', '/sdcard/a'], ['/sdcard/a', '/sdcard'], ['/sdcard', '/sdcard']])('returns one ancestor for %s', (value, expected) => {
    expect(parentTransferPath(value)).toBe(expected);
  });
  it.each(['browse', 'folder', 'recent'])('declares %s folder navigation and retains the destination under nested input', prefix => {
    const folder = NAVIGATION_DECLARATION.transitions.find(t => t.id === `${prefix}.transfer.folder.open`)!;
    const nested = NAVIGATION_DECLARATION.transitions.find(t => t.id === `${prefix}.modal.transfer.newFolder.open`)!;
    expect(folder.mode).toBe('replace');
    expect(folder.searchParams).toHaveProperty('transferPath', 'string');
    expect(nested.preserveParams).toContain('transferPath');
    expect(nested.preserveParams).toContain('operation');
  });
});
