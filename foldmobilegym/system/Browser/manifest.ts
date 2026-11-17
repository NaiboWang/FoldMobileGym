import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'browser',
  packageName: 'com.android.chrome',
  displayName: 'Chrome',
  displayNameEn: 'Google Chrome',
  aliases: ['浏览器', '谷歌浏览器', 'Google Chrome'],
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#1a73e8',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#1a73e8',
      primaryDark: '#185abc',
      background: '#ffffff',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.ACCESS_FINE_LOCATION,
    PERMISSIONS.CAMERA,
  ],
  intentFilters: [
    {
      action: 'ACTION_VIEW',
      scheme: 'http',
      route: '/view',
      description: '打开 http 链接',
    },
    {
      action: 'ACTION_VIEW',
      scheme: 'https',
      route: '/view',
      description: '打开 https 链接',
    },
  ],
};
