import type { AppManifest } from '@/os/types/manifest';
import { IcLauncherGlyph } from './res/icons';

export const manifest: AppManifest = {
  id: 'taobao',
  packageName: 'com.taobao.taobao',
  displayName: '淘宝',
  displayNameEn: 'Taobao',
  aliases: ['淘宝', '手机淘宝'],
  version: '10.55.0',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncherGlyph,
  iconBackground: '#ff5000',
  iconForeground: '#ffffff',
  theme: {
    colors: {
      primary: '#ff5000',
      background: '#f5f5f5',
      surface: '#ffffff',
      textPrimary: '#222222',
      textSecondary: '#777777',
      border: '#eeeeee',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
};
