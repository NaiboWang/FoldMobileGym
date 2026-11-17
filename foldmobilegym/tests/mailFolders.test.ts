import { describe, expect, it } from 'vitest';
import { mailFolderFromPath, mailFolderParent, mailFolderRows } from '../apps/Mail/folders';
import { mailSearchBackFallback } from '../apps/Mail/searchRouting';
import type { Message, Draft } from '../apps/Mail/types';
const messages: Message[] = [
  { id: 'a', from: 'A', subject: 'First', date: '2026-10-28', body: 'Original' },
  { id: 'b', from: 'B', subject: 'Second', date: '2026-10-28', body: 'Other' },
];
const drafts: Draft[] = [{ id: 'a', to: 'a@example.invalid', subject: 'Draft', body: 'Unsent' }];
describe('Mail folder sources and return context', () => {
  it('keeps the existing inbox corpus and original references', () => {
    const result = mailFolderRows('inbox', messages, drafts, ['a']);
    expect(result.messages).toBe(messages); expect(result.drafts).toBe(drafts);
  });
  it('filters stars only from actual messages, never same-ID drafts or unknown IDs', () => {
    const result = mailFolderRows('starred', messages, drafts, ['a', 'absent']);
    expect(result.messages).toEqual([messages[0]]); expect(result.messages[0]).toBe(messages[0]);
    expect(result.drafts).toEqual([]);
  });
  it('separates saved drafts and all received mail without copying records', () => {
    expect(mailFolderRows('drafts', messages, drafts).messages).toEqual([]);
    expect(mailFolderRows('drafts', messages, drafts).drafts).toBe(drafts);
    expect(mailFolderRows('all', messages, drafts).messages).toBe(messages);
    expect(mailFolderRows('all', messages, drafts).drafts).toEqual([]);
  });
  it.each(['starred', 'drafts', 'all'])('parses the supported %s folder', folder => {
    expect(mailFolderFromPath('/folder/' + folder)).toBe(folder);
    expect(mailFolderParent(folder)).toBe('/folder/' + folder);
  });
  it.each(['/folder/unknown', '/folder/inbox', '/folder/starred/more', '/folder/%bad'])('does not substitute another folder for %s', path => expect(mailFolderFromPath(path)).toBeNull());
  it('reconstructs a cold folder, drawer and search parent without accepting path injection', () => {
    expect(mailSearchBackFallback('/folder/drafts', '')).toBe('/');
    expect(mailSearchBackFallback('/folder/drafts', '', { pathname: '/folder/drafts', search: '' })).toBe('/');
    expect(mailSearchBackFallback('/folder/drafts', '', { pathname: '', search: '' })).toBe('/');
    expect(mailSearchBackFallback('/folder/drafts', '?drawer=open')).toBe('/folder/drafts');
    expect(mailSearchBackFallback('/folder/drafts', '?drawer=open', { pathname: '/folder/drafts', search: '' })).toBeNull();
    expect(mailSearchBackFallback('/folder/drafts', '?drawer=open', { pathname: '/search', search: '' })).toBe('/folder/drafts');
    expect(mailSearchBackFallback('/search', '?q=sample&originFolder=starred')).toBe('/folder/starred');
    expect(mailSearchBackFallback('/search', '?originFolder=../other')).toBe('/');
  });
  it('retains folder identity through cold and warm source-bound replies', () => {
    expect(mailSearchBackFallback('/reply/a', '?origin=folder&originFolder=all')).toBe('/folder/all');
    expect(mailSearchBackFallback('/reply/a', '?origin=folderDrafts&originFolder=drafts', { pathname: '/folder/drafts', search: '' })).toBeNull();
    expect(mailSearchBackFallback('/reply/a', '?origin=search&originFolder=starred&q=term')).toBe('/search/message/a?q=term&originFolder=starred');
  });
});
