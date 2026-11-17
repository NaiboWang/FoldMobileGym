import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('vite.config.ts', 'utf8');
describe('Tailwind CLI launch from a checkout path containing spaces', () => {
  it('uses the JavaScript CLI entry instead of a Windows shell wrapper', () => {
    expect(source).toContain("'@tailwindcss', 'cli', 'dist', 'index.mjs'");
    expect(source).toContain("execFileSync(process.execPath, [bin, '-i', input, '-o', output]");
    expect(source).toContain("spawn(process.execPath, [bin, '-i', input, '-o', output, '--watch=always']");
    expect(source).not.toContain('shell: isWin');
  });
});
