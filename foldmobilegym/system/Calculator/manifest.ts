import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'calculator',
  packageName: 'com.miui.calculator',
  displayName: '计算器',
  displayNameEn: 'Calculator',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ff7e45',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#f97316',
      primaryDark: '#ea580c',
      background: '#f3f3f7',
      surface: '#ffffff',
      textPrimary: '#232327',
      textSecondary: '#9ca3af',
      border: '#e3e3e8',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
    colorsDark: {
      primary: '#f97316', textSecondary: '#9ca3af',
      background: '#17171b', surface: '#29292e', textPrimary: '#f4f4f7',
      border: '#37373d', statusBarForeground: 'light', navigationBarForeground: 'light',
    },
  },
};
