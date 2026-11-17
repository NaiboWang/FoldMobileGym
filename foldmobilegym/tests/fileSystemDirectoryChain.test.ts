import { describe, expect, it } from 'vitest';
import * as fs from '@/os/FileSystemService';

describe('recursive directory chains', () => {
  it('links every new ancestor by its actual parent identity', async () => {
    const paths = ['/sdcard/directory-chain-test', '/sdcard/directory-chain-test/a', '/sdcard/directory-chain-test/a/b'];
    await fs.createDirectory(paths[2]);
    for (let i = 1; i < paths.length; i += 1) {
      expect(fs.getNode(paths[i])?.parentId).toBe(fs.getNode(paths[i - 1])?.id);
      expect(fs.listDirectory(paths[i - 1]).map(node => node.path)).toContain(paths[i]);
    }
  });
  it('does not create descendants below a file', async () => {
    const file = await fs.writeFile('/sdcard/directory-chain-blocker.txt', 'keep');
    const before = { ...file };
    await expect(fs.createDirectory(`${file.path}/invalid/child`)).rejects.toThrow('Cannot create directory');
    expect(fs.exists(`${file.path}/invalid`)).toBe(false);
    expect(fs.exists(`${file.path}/invalid/child`)).toBe(false);
    expect(fs.getNode(file.path)).toEqual(before);
  });
});
