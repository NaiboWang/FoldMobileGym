import PackageManagerService from '../../os/PackageManagerService';
import type { AppManifest } from '../../os/types/manifest';
import { EXCLUDED_IDS } from './constants';
export function getCatalog(): AppManifest[] {
  return PackageManagerService.getInstalledPackages().filter(app => !EXCLUDED_IDS.has(app.id));
}
export function searchCatalog(catalog: AppManifest[], query: string): AppManifest[] {
  const term = query.trim().toLowerCase();
  return catalog.filter(app => [app.id, app.displayName, app.displayNameEn ?? '', ...(app.aliases ?? [])]
    .join(' ').toLowerCase().includes(term));
}
