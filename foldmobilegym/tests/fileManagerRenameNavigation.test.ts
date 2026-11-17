import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const RENAME_SOURCES = [
  'system/FileManager/pages/BrowseHomePage.tsx',
  'system/FileManager/pages/RecentPage.tsx',
  'system/FileManager/pages/FolderPage.tsx',
];

function extractDoRenameBody(source: string): string {
  const start = source.indexOf('const doRename = async');
  expect(start).toBeGreaterThanOrEqual(0);

  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart, i + 1);
  }
  throw new Error('未能解析 doRename 函数体');
}

describe('FileManager 重命名导航', () => {
  it('重命名返回实际结果，由共享输入弹窗统一关闭，不额外返回历史', () => {
    for (const path of RENAME_SOURCES) {
      const source = readFileSync(path, 'utf8');
      const doRenameBody = extractDoRenameBody(source);

      expect(doRenameBody, path).toContain('return true;');
      expect(doRenameBody, path).toContain('return false;');
      expect(doRenameBody, path).not.toContain('closeModal();');
      expect(doRenameBody, path).not.toContain('exitSelectMode();');
    }
  });
});
