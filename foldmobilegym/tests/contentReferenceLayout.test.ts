import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeBilibiliEntryRoute } from '../apps/Bilibili/utils/entryRoute';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';
import { strings } from '../apps/Spotify/res/strings';
import { stringsEn } from '../apps/Spotify/res/strings.en';

const source = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
describe('Content reference adaptive layout contracts', () => {
  it.each([
    ['/', '/?tab=recommend'],
    ['/?source=launcher', '/?source=launcher&tab=recommend'],
    ['/?tab=hot', '/?tab=hot'],
    ['/video/example?tab=comment', '/video/example?tab=comment'],
    ['/following?tab=all', '/following?tab=all'],
  ])('canonicalizes only bare Bilibili home entry %s', (entry, expected) => {
    expect(normalizeBilibiliEntryRoute(entry)).toBe(expected);
    expect(normalizeBilibiliEntryRoute(expected)).toBe(expected);
  });
  it('keeps Bilibili feed sizing local, outside the blanket four-column selector', () => {
    const page = source('apps/Bilibili/pages/HomePage.tsx');
    expect(page).toContain('bili-recommend-grid grid gap-2');
    expect(page).not.toContain('BigVideoCard');
    expect(source('apps/Bilibili/reference.css')).toContain('repeat(3, minmax(0, 1fr))');
  });
  it('binds Bilibili settings at literal call sites rather than rebinding string props', () => {
    const settings = source('apps/Bilibili/pages/SettingsPage.tsx');
    const playback = source('apps/Bilibili/pages/settings/SettingsPlaybackPage.tsx');
    expect(settings).not.toContain('bindTap(transitionId');
    expect(settings).toContain("bindTap<HTMLButtonElement>('settings.playback.open')");
    expect(playback).not.toContain('go(item.transitionId');
    expect(playback).toContain("bindTap<HTMLDivElement>('settings.playback.quality.open')");
  });
  it.each(['/contact/:contactId', '/call/:callLogId'])('declares separate concurrent scrollers for %s', path => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === path);
    expect(route?.scrollContainers.map(container => container.name)).toEqual(
      path === '/contact/:contactId' ? ['main', 'directory', 'confirmation', 'menu', 'smsNumbers'] : ['main', 'directory'],
    );
  });
  it('keeps contact-derived hooks before the missing-contact early return', () => {
    const page = source('system/Contacts/pages/ContactDetailPage.tsx');
    expect(page.indexOf('const relatedCallLogs = useMemo')).toBeLessThan(page.indexOf('if (!contact)'));
    expect(page).toContain('[contact?.phones]');
  });
  it('does not fabricate lyrics from a track title', () => {
    const player = source('apps/Spotify/pages/PlayerPage.tsx');
    expect(player).toContain('s.player_lyrics_unavailable');
    expect(player).not.toContain('歌曲的歌词');
    expect(strings.player_lyrics_unavailable).toBeTruthy();
    expect(stringsEn.player_lyrics_unavailable).toBeTruthy();
  });
});
