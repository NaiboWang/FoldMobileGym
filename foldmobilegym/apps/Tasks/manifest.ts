import type { AppManifest } from '@/os/types/manifest';
import { IcLauncher } from './res/icons';
export const manifest: AppManifest = {
  id: 'tasks', packageName: 'com.microsoft.todos', displayName: 'Microsoft To Do', displayNameEn: 'Microsoft To Do', aliases: ['待办', '任务', '待办事项'],
  version: '1.0.0', versionCode: 1, type: 'plugin', icon: IcLauncher, iconBackground: '#ffffff', iconForeground: '#2564cf',
  theme: { colors: { primary: '#2564cf', background: '#f7f7f7', surface: '#ffffff', textPrimary: '#252423', textSecondary: '#605e5c', border: '#edebe9', statusBarForeground: 'dark', navigationBarForeground: 'dark' } },
};
