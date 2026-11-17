import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { leadingSpotifyImagePriority } from '../apps/Spotify/imagePolicy';
// The existing locked Babel parser produces the same raw attribute AST as the
// compiler, without loading the full TypeScript compiler into a test worker.
const { parse } = createRequire(import.meta.url)('@babel/parser');
type Attribute = { name?: string; initializer?: { getText: () => string } };
type Attributes = { properties: Attribute[] };
function images(relative: string) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] }), result: Attributes[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, any>;
    if (node.type === 'JSXOpeningElement' && node.name?.name === 'img') result.push({ properties: node.attributes.map((a: any) => ({ name: a.name?.name,
      initializer: a.value ? { getText: () => source.slice(a.value.start, a.value.end) } : undefined })) });
    for (const [key, child] of Object.entries(node)) {
      if (['loc', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(ast); return { source, result };
}
const attribute = (attrs: Attributes, name: string) => attrs.properties.find(p => p.name === name);
describe('Spotify initial image request hints, not replacement or relaxed media checks', () => {
  it.each([0, 1, 2, 3])('gives a leading card an initial high hint: %s', index => { expect(leadingSpotifyImagePriority(index)).toBe('high'); });
  it.each([-1, 4, 100, NaN, Infinity])('does not promote the rest of the catalog or malformed positions: %s', index => { expect(leadingSpotifyImagePriority(index)).toBe('auto'); });
  it('retains every Home image source while making offscreen content native-lazy', () => {
    const { source, result } = images('../apps/Spotify/pages/HomePage.tsx');
    expect(result).toHaveLength(24);
    for (const attrs of result) { expect(attribute(attrs, 'loading')?.initializer?.getText()).toBe('"lazy"'); expect(attribute(attrs, 'src')).toBeDefined(); }
    expect(result.filter(attrs => attribute(attrs, 'fetchPriority'))).toHaveLength(5);
    expect(source).not.toMatch(/aedecdb6895dd59b|f940da4a707b785a|6bc77d32f027943b/);
  });
  it('prioritizes the actual mini-player cover without changing its source or dimensions', () => {
    const { result } = images('../apps/Spotify/components/BottomPlayer.tsx'); expect(result).toHaveLength(1);
    expect(attribute(result[0], 'loading')?.initializer?.getText()).toBe('"lazy"');
    expect(attribute(result[0], 'fetchPriority')?.initializer?.getText()).toBe('"high"');
    expect(attribute(result[0], 'src')?.initializer?.getText()).toBe('{currentTrack.cover}');
    expect(attribute(result[0], 'className')?.initializer?.getText()).toBe('"w-full h-full object-cover"');
  });
});
