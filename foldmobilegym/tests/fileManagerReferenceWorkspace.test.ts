import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/FileManager/navigation.declaration';
import { strings } from '../system/FileManager/res/strings';
import {
  DEFAULT_FILE_MANAGER_SETTINGS,
  normalizeFileManagerSettings,
} from '../system/FileManager/state';

describe('FileManager recorded unfolded workspace', () => {
  it('declares the persistent directory navigation without replacing existing file flows', () => {
    const ids = NAVIGATION_DECLARATION.transitions.map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      'rail.browse.open',
      'rail.recent.open',
      'rail.folder.open',
      'rail.category.open',
      'settings.open',
    ]));
    expect(ids).toEqual(expect.arrayContaining(['folder.open', 'category.open', 'search.open']));
  });

  it('declares directory scrolling on each recorded rail-owned surface', () => {
    for (const routePath of ['/', '/recent', '/folder', '/category/:category']) {
      const route = NAVIGATION_DECLARATION.routes.find(item => item.path === routePath)!;
      expect(route.scrollContainers.map(item => item.name)).toContain('directory');
    }
  });

  it('keeps recorded directory labels in localized resources', () => {
    expect(strings.directory_title).toBe('文件管理');
    expect(strings.directory_my_files).toBe('我的文件');
    expect(strings.directory_quick_access).toBe('快速访问');
  });

  it('declares the recorded settings toggles as real simulator actions', () => {
    const route = NAVIGATION_DECLARATION.routes.find(item => item.path === '/settings')!;
    expect(route.uiStates[0].actions?.map(item => item.id)).toEqual([
      'file.settings.mobileData.toggle',
      'file.settings.hidden.toggle',
      'file.settings.systemHidden.toggle',
      'file.settings.autoCollect.toggle',
    ]);
  });

  it('migrates persisted FileManager states that predate the settings surface', () => {
    expect(normalizeFileManagerSettings(undefined)).toEqual(DEFAULT_FILE_MANAGER_SETTINGS);
    expect(normalizeFileManagerSettings({ showHiddenFiles: true })).toEqual({
      ...DEFAULT_FILE_MANAGER_SETTINGS,
      showHiddenFiles: true,
    });
  });
});
