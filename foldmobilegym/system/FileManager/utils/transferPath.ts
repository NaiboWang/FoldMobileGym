export const TRANSFER_ROOT_PATH = '/sdcard';

/** Picker destinations stay inside the virtual shared-storage namespace. */
export function normalizeTransferPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.includes('\u0000')) return TRANSFER_ROOT_PATH;
  const parts = value.split('/').filter(Boolean);
  if (parts[0] !== 'sdcard' || parts.some(part => part === '.' || part === '..')) return TRANSFER_ROOT_PATH;
  return '/' + parts.join('/');
}

export function parentTransferPath(value: string): string {
  const path = normalizeTransferPath(value);
  return path === TRANSFER_ROOT_PATH ? path : path.slice(0, path.lastIndexOf('/'));
}
