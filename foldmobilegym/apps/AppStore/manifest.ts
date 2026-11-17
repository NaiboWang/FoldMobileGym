import type { AppManifest } from '../../os/types/manifest';
import { IcLauncher } from './res/icons';
export const manifest: AppManifest = {
  id: 'appstore', packageName: 'org.foldagent.appstore',
  displayName: 'App Store', displayNameEn: 'App Store', aliases: ['应用商店', 'app store'],
  version: '1.0.0', versionCode: 1, type: 'plugin',
  icon: IcLauncher, iconBackground: '#087dff', iconForeground: '#ffffff',
  theme: { colors: {
    primary: '#087dff', primaryDark: '#0064d1', background: '#ffffff', surface: '#ffffff',
    textPrimary: '#172033', textSecondary: '#64748b', border: '#e7ebf1',
    statusBarForeground: 'dark', navigationBarForeground: 'dark',
  } },
};
