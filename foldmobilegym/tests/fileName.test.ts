import { describe, expect, it } from 'vitest';
import { isValidFileName } from '@/system/FileManager/utils/fileName';
describe('virtual file names', () => {
  it.each(['', '   ', '.', '..', 'a/b', '/root', 'a\u0000b', 'a'.repeat(256), '界'.repeat(86)])('rejects invalid component %j', value => {
    expect(isValidFileName(value)).toBe(false);
  });
  it.each(['文档.txt', 'photo 1.jpg', '.hidden', ' a.txt ', '...', 'a'.repeat(255), '界'.repeat(85)])('accepts a single legal component %j', value => {
    expect(isValidFileName(value)).toBe(true);
  });
});
