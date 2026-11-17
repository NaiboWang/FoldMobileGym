import { describe, expect, it } from 'vitest';
import PackageManagerService from '../os/PackageManagerService';

const excluded = ['workspace_docs', 'study_cards', 'food_info', 'video', 'fitness', 'tasks', 'calculator2'];

describe('confirmed deployment app selection', () => {
  it.each(excluded)('does not install or resolve excluded package %s', id => {
    expect(PackageManagerService.isInstalled(id)).toBe(false);
    expect(PackageManagerService.getPackageInfo(id)).toBeUndefined();
    expect(PackageManagerService.queryByAlias(id)).toBeUndefined();
    expect([...PackageManagerService.dirToAppId.values()]).not.toContain(id);
  });

  it('does not expose historical WPS names or its package name', () => {
    for (const alias of ['WPS', 'WPS Office', '工作区文档']) {
      expect(PackageManagerService.queryByAlias(alias)).toBeUndefined();
    }
    expect(PackageManagerService.resolvePackageName('cn.wps.moffice_eng')).toBeUndefined();
  });

  it('retains Meituan, App Store and the single selected calculator', () => {
    for (const id of ['meituan_waimai', 'appstore', 'calculator']) {
      expect(PackageManagerService.isInstalled(id)).toBe(true);
    }
    const ids = PackageManagerService.getInstalledPackages().map(app => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter(id => !['app_picker', 'intent_chooser', 'permission_controller', 'package_installer'].includes(id))).toHaveLength(30);
  });
});
