/** A single virtual Android path component, not an arbitrary destination path. */
export function isValidFileName(value: string): boolean {
  const name = value.trim();
  return name.length > 0 && name !== '.' && name !== '..' &&
    !/[\/\u0000]/.test(name) && new TextEncoder().encode(name).length <= 255;
}
