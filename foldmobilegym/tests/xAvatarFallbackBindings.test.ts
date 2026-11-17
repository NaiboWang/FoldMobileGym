import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const avatarScreens = [
  'components/XDrawer.tsx',
  'pages/ChatPage.tsx',
  'pages/ComposePage.tsx',
  'pages/MessagesPage.tsx',
  'pages/NotificationsPage.tsx',
  'pages/SearchInputPage.tsx',
  'pages/SearchPage.tsx',
];

describe('X remote avatars', () => {
  it('routes both video poster states through the image fallback', () => {
    const source = readFileSync(new URL('../apps/X/components/XMedia.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('<img src={displayPoster');
    expect(source.match(/<XImage src=\{displayPoster \|\| poster\}/g)).toHaveLength(2);
  });
  it('uses fallback handling for the promoted search image too', () => {
    const source = readFileSync(new URL('../apps/X/pages/SearchPage.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('<img');
    expect(source).toContain('<XImage src={trends.find');
  });
  it('uses the image fallback component throughout main account screens', () => {
    for (const file of avatarScreens) {
      const source = readFileSync(new URL(`../apps/X/${file}`, import.meta.url), 'utf8');
      expect(source, file).toContain('<XImage');
      expect(source, file).not.toMatch(/<img\b[^>]*\bsrc=\{[^}]*\bavatar\b/);
    }
  });
});
