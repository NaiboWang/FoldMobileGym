import { describe, expect, it } from 'vitest';
import { manifest } from '../apps/MeituanWaimai/manifest';
import PackageManagerService from '../os/PackageManagerService';

describe('Meituan main application identity, with legacy task-state compatibility', () => {
  it('uses the reference main App name and package, not the separate takeout package', () => {
    expect(manifest.displayName).toBe('美团');
    expect(manifest.displayNameEn).toBe('Meituan');
    expect(manifest.packageName).toBe('com.sankuai.meituan');
    expect(PackageManagerService.resolvePackageName('com.sankuai.meituan')).toBe('meituan_waimai');
    expect(PackageManagerService.resolvePackageName('com.sankuai.meituan.takeoutnew')).toBeUndefined();
  });
  it('keeps the existing App ID and resolves both the corrected name and old food-task names', () => {
    expect(manifest.id).toBe('meituan_waimai');
    for (const name of ['美团', 'Meituan', '美团外卖', 'Meituan Waimai', '外卖']) {
      expect(PackageManagerService.queryByAlias(name)).toBe('meituan_waimai');
    }
    expect(PackageManagerService.getInstalledPackages().filter(app => app.id === manifest.id)).toHaveLength(1);
  });
});
