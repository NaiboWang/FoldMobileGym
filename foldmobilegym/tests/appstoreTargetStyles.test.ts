/** Declared CSS regression only; actual geometry/hit testing lives in the browser diagnostic. */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import postcss from 'postcss';

const css = postcss.parse(readFileSync(new URL('../apps/AppStore/appstore.css', import.meta.url), 'utf8'));
function property(selector: string, name: string) {
  let value: string | undefined;
  css.walkRules(selector, rule => { rule.walkDecls(name, declaration => { value = declaration.value; }); });
  return value;
}

describe('App Store local CSS target dimensions', () => {
  it('search and open buttons declare at least 44px in both dimensions', () => {
    for (const selector of ['.appstore-search button', '.appstore-open']) {
      expect(property(selector, 'min-width')).toBe('44px');
      expect(property(selector, 'min-height')).toBe('44px');
    }
  });
  it('search input grows vertically but still allows narrow-screen flex shrinking', () => {
    expect(property('.appstore-search input', 'min-height')).toBe('44px');
    expect(property('.appstore-search input', 'min-width')).toBe('0');
    expect(property('.appstore-search input', 'flex')).toBe('1');
  });
});
