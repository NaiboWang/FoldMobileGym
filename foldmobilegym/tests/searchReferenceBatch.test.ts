import { describe, expect, it } from 'vitest';
import { filterSearchFiles, normalizeSearchCategory, searchFileDestination } from '../system/FileManager/utils/searchFiles';
import { splitSearchHighlight } from '../apps/WechatReading/utils/searchHighlight';
import { NAVIGATION_DECLARATION as BROWSER } from '../system/Browser/navigation.declaration';
import { NAVIGATION_DECLARATION as FILES } from '../system/FileManager/navigation.declaration';
import type { FSNode } from '../os/types';

const file = (name: string, mimeType: string, modifiedAt = 1): FSNode => ({ id: name, name, mimeType, modifiedAt,
  path: '/sdcard/Documents/' + name, type: 'file', parentId: 'docs', size: 50, createdAt: 1, storage: 'memory' });
const files = [file('Report.PDF', 'application/pdf', 3), file('note[1].md', 'text/markdown', 2), file('photo.jpg', 'image/jpeg'),
  file('clip.mp4', 'video/mp4'), file('song.mp3', 'audio/mpeg'), { ...file('Folder', ''), type: 'directory' as const }];
describe('Reference search and browser contracts', () => {
  it('searches literal filenames case-insensitively without altering records', () => {
    const before = JSON.stringify(files);
    expect(filterSearchFiles(files, ' report ', 'all').map(f => f.name)).toEqual(['Report.PDF']);
    expect(filterSearchFiles(files, '[1]', 'all').map(f => f.name)).toEqual(['note[1].md']);
    expect(JSON.stringify(files)).toBe(before);
  });
  it.each([['images', 'photo.jpg'], ['videos', 'clip.mp4'], ['audio', 'song.mp3']] as const)('filters %s', (category, name) => {
    expect(filterSearchFiles(files, '', category).map(f => f.name)).toEqual([name]);
  });
  it('includes PDF and text in documents and excludes directories', () => {
    expect(filterSearchFiles(files, '', 'documents').map(f => f.name)).toEqual(['Report.PDF', 'note[1].md']);
    expect(filterSearchFiles(files, '', 'all')).toHaveLength(5);
    expect(filterSearchFiles(files, 'missing', 'all')).toEqual([]);
  });
  it('normalizes invalid category values to All', () => {
    for (const value of [null, '', 'all', 'invalid']) expect(normalizeSearchCategory(value)).toBe('all');
    expect(normalizeSearchCategory('images')).toBe('images');
  });
  it('opens only supported preview types and uses the containing folder otherwise', () => {
    expect(searchFileDestination(files[0])).toEqual({ kind: 'pdf', path: files[0].path });
    expect(searchFileDestination(files[1])).toEqual({ kind: 'text', path: files[1].path });
    expect(searchFileDestination(files[2])).toEqual({ kind: 'folder', path: '/sdcard/Documents' });
    expect(searchFileDestination({ ...files[2], path: '/photo.jpg' })).toEqual({ kind: 'folder', path: '/' });
  });
  it.each(['[', ']', '+', '.', '*', '?', '\\', '(', ')', '{', '}', '^', '$', '|'])('highlights literal metacharacter %s safely', query => {
    const text = `before ${query} after`;
    expect(splitSearchHighlight(text, query)).toEqual(['before ', query, ' after']);
  });
  it('preserves empty queries and performs case-insensitive highlighting', () => {
    expect(splitSearchHighlight('Report report', '')).toEqual(['Report report']);
    expect(splitSearchHighlight('Report report', 'report')).toEqual(['', 'Report', ' ', 'report', '']);
  });
  it('declares pushed overview states so system back can close them', () => {
    for (const path of ['/', '/view']) {
      const route = BROWSER.routes.find(route => route.path === path);
      expect(route?.uiStates.some(state => 'panel' in state.search && state.search.panel === 'tabs')).toBe(true);
      expect(route?.scrollContainers.map(c => c.name)).toEqual(['main', 'tabs', 'overview']);
    }
    expect(BROWSER.transitions.filter(t => t.id.startsWith('tabs.open.')).every(t => t.mode === 'push')).toBe(true);
  });
  it('replaces filename and filter queries, not the search back stack entry', () => {
    const route = FILES.routes.find(route => route.path === '/search');
    expect(route?.queryParams).toEqual({ q: 'string' });
    for (const id of ['search.query.update', 'search.filter.switch']) expect(FILES.transitions.find(t => t.id === id)?.mode).toBe('replace');
    expect(FILES.transitions.find(t => t.id === 'search.open')?.mode).toBe('push');
  });
});
