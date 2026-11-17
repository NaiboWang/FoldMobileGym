import { describe, expect, it } from 'vitest';
import { galleryViewerPath } from '../system/Gallery/viewerPath';

describe('Gallery raw route file identity', () => {
  it.each([
    '/sdcard/Pictures/photo_001.jpg',
    '/sdcard/Pictures/搜索%2F [1].jpg',
    '/sdcard/Pictures/搜索%2f [1].jpg',
    '/sdcard/Pictures/100% ready #1?.jpg',
    '/sdcard/Pictures/literal%252F.jpg',
  ])('decodes the route exactly once: %s', path => {
    expect(galleryViewerPath('/photo/' + encodeURIComponent(path))).toBe(path);
  });
  it('does not conflate a literal percent escape with a directory separator', () => {
    const literal = '/sdcard/Pictures/a%2Fb.jpg', nested = '/sdcard/Pictures/a/b.jpg';
    expect(galleryViewerPath('/photo/' + encodeURIComponent(literal))).not.toBe(nested);
  });
  it.each(['/photo/%', '/photo/%E0%A4%A', '/intent/view', '/search'])('rejects malformed or foreign routes: %s', route => {
    expect(galleryViewerPath(route)).toBe('');
  });
});
