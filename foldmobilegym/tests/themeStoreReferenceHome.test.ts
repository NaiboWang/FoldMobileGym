import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../system/ThemeStore/ThemeStoreApp.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../system/ThemeStore/reference.css', import.meta.url), 'utf8');

describe('Theme Store reference home', () => {
  it('keeps the real catalog/detail transition on featured and official cards', () => {
    expect(component).toContain("bindTap('item.open'");
    expect(component).toContain('data-theme-store-hero');
    expect(component).toContain('data-theme-store-official');
    expect(component).toContain('items.slice(4).map');
  });

  it('uses the observed category, banner, official collection, ranking and floating navigation hierarchy', () => {
    for (const token of ['theme-store-category-rail', 'theme-store-hero-strip', 'theme-store-official-grid', 'theme-store-ranking-grid', 'theme-store-floating-nav']) {
      expect(css).toContain(`.${token}`);
    }
    expect(css).toContain('grid-template-columns: repeat(3');
    expect(css).toContain('grid-template-columns: repeat(4');
    expect(css).toContain('@container (min-width: 620px)');
    expect(component).toContain('<Route path="/ranking" element={<ThemeStoreRankingPage />} />');
  });

  it('does not add external or private image assets', () => {
    expect(css).not.toMatch(/url\s*\(/);
    expect(component).not.toMatch(/https?:\/\//);
  });

  it('marks unsupported reference destinations as inert instead of inventing actions', () => {
    expect(component).toContain('aria-disabled="true"');
    expect(component).not.toContain("bindTap('search");
    expect(component).toContain("bindTap('ranking.open')");
    expect(component).toContain("bindTap('home.open')");
  });
});

