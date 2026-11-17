import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from '@/os/FileSystemService';
import { transferNodesToDirectory } from '@/system/FileManager/utils/fileOperations';

// Real virtual metadata, never the host filesystem. Node has no IndexedDB blob
// backend: stub only blob copying; browser review must verify real file contents.
afterEach(() => vi.restoreAllMocks());
async function setup(name: string) {
  const root = `/sdcard/transfer-safety-${name}`;
  await fs.createDirectory(`${root}/source`);
  await fs.createDirectory(`${root}/target`);
  vi.spyOn(fs, 'copyFile').mockImplementation(async (src, dest) => {
    const source = fs.getNode(src);
    if (!source) return null;
    return fs.writeFile(dest, 'payload', { mimeType: source.mimeType });
  });
  return root;
}

for (const operation of ['copy', 'move'] as const) {
  describe(`${operation} preflight`, () => {
    it('rejects a late collision before modifying any earlier item', async () => {
      const root = await setup(`${operation}-collision`);
      const first = await fs.writeFile(`${root}/source/first.txt`, 'first');
      const second = await fs.writeFile(`${root}/source/second.txt`, 'source');
      const existing = await fs.writeFile(`${root}/target/second.txt`, 'keep');
      const before = { ...existing };
      expect(await transferNodesToDirectory([first, second], `${root}/target`, operation)).toBe(false);
      expect(fs.exists(`${root}/target/first.txt`)).toBe(false);
      expect(fs.getNode(existing.path)).toEqual(before);
      expect(fs.exists(`${root}/source/first.txt`)).toBe(true);
      expect(fs.exists(`${root}/source/second.txt`)).toBe(true);
    });

    it('rejects a directory inside its own subtree without creating anything', async () => {
      const root = await setup(`${operation}-subtree`);
      const source = fs.getNode(`${root}/source`)!;
      await fs.createDirectory(`${source.path}/nested`);
      expect(await transferNodesToDirectory([source], `${source.path}/nested`, operation)).toBe(false);
      expect(fs.exists(`${source.path}/nested/source`)).toBe(false);
    });

    it('does not merge an existing directory', async () => {
      const root = await setup(`${operation}-directory`);
      const source = fs.getNode(`${root}/source`)!;
      await fs.writeFile(`${source.path}/new.txt`, 'new');
      await fs.createDirectory(`${root}/target/source`);
      expect(await transferNodesToDirectory([source], `${root}/target`, operation)).toBe(false);
      expect(fs.listDirectory(`${root}/target/source`)).toHaveLength(0);
    });

    it('transfers a nested directory to an unused destination', async () => {
      const root = await setup(`${operation}-success`);
      const source = fs.getNode(`${root}/source`)!;
      await fs.writeFile(`${source.path}/nested/data.txt`, 'payload');
      expect(await transferNodesToDirectory([source], `${root}/target`, operation)).toBe(true);
      expect(fs.getNode(`${root}/target/source/nested/data.txt`)?.size).toBe(7);
      expect(fs.exists(`${root}/source`)).toBe(operation === 'copy');
    });

    it('rejects two source items with the same destination name', async () => {
      const root = await setup(`${operation}-duplicate-name`);
      const first = await fs.writeFile(`${root}/source/a/item.txt`, 'one');
      const second = await fs.writeFile(`${root}/source/b/item.txt`, 'two');
      expect(await transferNodesToDirectory([first, second], `${root}/target`, operation)).toBe(false);
      expect(fs.listDirectory(`${root}/target`)).toHaveLength(0);
    });
  });
}
