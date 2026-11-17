import { describe, expect, it } from 'vitest';
import { fileSearchNameParts, filterSearchFiles } from '../system/FileManager/utils/searchFiles';
import type { FSNode } from '../os/types';

describe('file search name presentation', () => {
  it.each([
    ['Report[1].txt', ' [1] ', ['[1]']],
    ['Report[1].txt', 'report', ['Report']],
    ['a.+(x).txt', '.+(x)', ['.+(x)']],
    ['材料材料.txt', '材料', ['材料', '材料']],
    ['İFILE😀.txt', 'file😀', ['FILE😀']],
    ['İFILE.txt', 'i', ['İ', 'I']],
    ['ΟΣ.txt', 'ος', []], // Existing filename filter treats the suffix as continuing the cased word.
    ['ΟΣ', 'ος', ['ΟΣ']],
    ['plain.txt', '', []],
    ['plain.txt', '   ', []],
    ['plain.txt', '<b>', []],
  ])('preserves %s while highlighting literal %s', (name, query, matches) => {
    const parts = fileSearchNameParts(name, query);
    expect(parts.map(part => part.text).join('')).toBe(name);
    expect(parts.filter(part => part.match).map(part => part.text)).toEqual(matches);
  });
});

describe('file search type filters', () => {
  const files = [
    { id: 'zip', name: 'backup.zip', type: 'file', mimeType: 'application/zip', modifiedAt: 3, path: '/sdcard/backup.zip' },
    { id: 'apk', name: 'demo.apk', type: 'file', mimeType: 'application/vnd.android.package-archive', modifiedAt: 2, path: '/sdcard/demo.apk' },
    { id: 'txt', name: 'readme.txt', type: 'file', mimeType: 'text/plain', modifiedAt: 1, path: '/sdcard/readme.txt' },
  ] as FSNode[];
  it('does not confuse archives, installers or arbitrary application binaries with documents', () => {
    const additional = [
      { ...files[0], id: 'bin', name: 'opaque.bin', mimeType: 'application/octet-stream' },
      { ...files[0], id: 'docx', name: 'report.DOCX', mimeType: 'application/octet-stream' },
      { ...files[0], id: 'json', name: 'config', mimeType: 'application/json; charset=utf-8' },
      { ...files[0], id: 'zip-text', name: 'pretend.zip', mimeType: 'text/plain' },
      { ...files[0], id: 'apk-text', name: 'pretend.apk', mimeType: 'text/plain' },
      { ...files[0], id: 'dir', name: 'folder.pdf', type: 'directory', mimeType: 'application/pdf' },
    ] as FSNode[];
    expect(filterSearchFiles([...files, ...additional], '', 'documents').map(file => file.id).sort()).toEqual(['docx', 'json', 'txt']);
    expect(filterSearchFiles([...files, ...additional], 'report', 'documents').map(file => file.id)).toEqual(['docx']);
    expect(filterSearchFiles([...files, ...additional], '', 'all').map(file => file.id)).toContain('bin');
  });
  it('separates archives and installers while leaving app filtering explicit', () => {
    expect(filterSearchFiles(files, '', 'archives').map(file => file.id)).toEqual(['zip']);
    expect(filterSearchFiles(files, '', 'packages').map(file => file.id)).toEqual(['apk']);
    expect(filterSearchFiles(files, '', 'apps')).toEqual([]);
  });
});
