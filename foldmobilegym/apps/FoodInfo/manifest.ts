import type { AppManifest } from '@/os/types/manifest';
import yukaIcon from './res/yuka-icon.png';
export const manifest: AppManifest = {
  id:'food_info',packageName:'io.yuka.android',displayName:'Yuka',displayNameEn:'Yuka',aliases:['食品信息','食品','营养信息'],
  version:'1.0.0',versionCode:1,type:'plugin',icon:yukaIcon,iconBackground:'#ffffff',iconForeground:'#35a853',
  theme:{colors:{primary:'#16a36a',background:'#f1f7f3',surface:'#fff',textPrimary:'#183126',textSecondary:'#6b7d73',border:'#dce8e1',statusBarForeground:'dark',navigationBarForeground:'dark'}}
};
