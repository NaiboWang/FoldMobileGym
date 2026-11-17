import { INITIAL_INSTALLED_PACKAGE_IDS } from './data/installedPackageIds.generated';

// Only identities, never GUI/manifest/icon imports. The packaged initial set is
// generated from the real selection policy; PackageManager replaces it at boot
// and on every actual install/uninstall. No parallel package-choice policy.
let installed: readonly string[] = INITIAL_INSTALLED_PACKAGE_IDS;
export function getInstalledPackageIds(): readonly string[] { return installed; }
export function setInstalledPackageIds(ids: readonly string[]): void { installed = Object.freeze([...ids]); }
