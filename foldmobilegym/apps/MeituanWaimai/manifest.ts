import type { AppManifest } from '@/os/types/manifest';
import { IcLauncher } from './res/icons';

export const manifest: AppManifest = {
  id: 'meituan_waimai',
  packageName: 'com.sankuai.meituan',
  displayName: '美团',
  displayNameEn: 'Meituan',
  aliases: ['美团外卖', 'Meituan Waimai', '外卖', '点餐'],
  version: '1.0.0',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#ffd100',
  iconForeground: '#292929',
  theme: { colors: { primary: '#ffd100', background: '#f7f7f7', surface: '#ffffff', textPrimary: '#292929', textSecondary: '#777777', border: '#ececec', statusBarForeground: 'dark', navigationBarForeground: 'dark' } },
};
