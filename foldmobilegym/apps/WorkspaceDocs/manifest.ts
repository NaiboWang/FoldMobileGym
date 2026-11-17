import type { AppManifest } from '@/os/types/manifest';
import { IcLauncher } from './res/icons';
export const manifest: AppManifest = {
  id: 'workspace_docs', packageName: 'cn.wps.moffice_eng', displayName: 'WPS Office', displayNameEn: 'WPS Office',
  aliases: ['WPS', '文档', '工作区文档'], version: '1.0.0', versionCode: 1, type: 'plugin', icon: IcLauncher,
  iconBackground: '#ef3340', iconForeground: '#ffffff',
  theme: { colors: { primary: '#ef3340', background: '#f5f5f5', surface: '#ffffff', textPrimary: '#202124', textSecondary: '#73777f', border: '#e4e5e7', statusBarForeground: 'dark', navigationBarForeground: 'dark' } },
};
