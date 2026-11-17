import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync('apps/RedBook/redbook-typography.css', 'utf8');
const app = readFileSync('apps/RedBook/RedBookApp.tsx', 'utf8');
describe('RedBook typography isolation', () => {
  it('loads the scoped stylesheet on the app owner', () => {
    expect(app).toContain("import './redbook-typography.css'");
    expect(app).toContain('className="redbook-app h-full w-full"');
    expect(app).not.toContain('<style>');
  });
  it('does not install document-wide font or smoothing rules', () => {
    const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...source.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(match => match[1].trim());
    expect(selectors).toEqual(['.redbook-app']);
    expect(source).not.toMatch(/!important/);
  });
  it('keeps the app sans family without overriding serif and mono utilities', () => {
    expect(css).toContain('--font-sans: var(--redbook-ui-font)');
    expect(css).toContain('font-family: var(--redbook-ui-font)');
    expect(css).not.toMatch(/--font-(serif|mono)\s*:/);
    expect(css).not.toMatch(/\.redbook-app\s+\*/);
  });
});
