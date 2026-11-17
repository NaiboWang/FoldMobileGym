import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/os/useAppStrings', () => ({
  useAppStrings: () => ({
    media_image_load_failed: 'Image failed',
    media_video_load_failed: 'Video failed',
    media_video_open_new_window: 'Open',
  }),
}));

describe('X media direct loading', () => {
  it('reserves readable space for pending auto-height media', async () => {
    const { XImage } = await import('../apps/X/components/XMedia');
    const html = renderToStaticMarkup(React.createElement(XImage, { src: 'https://example.test/post.jpg', alt: 'post', className: 'w-full h-auto object-cover' }));
    expect(html).toContain('min-height:120px');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('loading="lazy"');
  });

  it('does not force a media minimum onto fixed-size avatars', async () => {
    const { XImage } = await import('../apps/X/components/XMedia');
    const html = renderToStaticMarkup(React.createElement(XImage, { src: 'https://example.test/avatar.jpg', alt: 'user', className: 'w-full h-full object-cover' }));
    expect(html).not.toContain('min-height');
  });

  it('keys attempt ownership by raw source, not labels or presentation', async () => {
    const { XImage } = await import('../apps/X/components/XMedia');
    const first = XImage({ src: '/first.jpg', alt: 'first' });
    const relabeled = XImage({ src: '/first.jpg', alt: 'changed', className: 'h-auto' });
    const next = XImage({ src: '/second.jpg', alt: 'first' });
    expect(first.key).toBe(relabeled.key);
    expect(first.type).toBe(relabeled.type);
    expect(next.key).not.toBe(first.key);
  });

  it('does not create a loading placeholder for an absent image', async () => {
    const { XImage } = await import('../apps/X/components/XMedia');
    expect(renderToStaticMarkup(React.createElement(XImage, { alt: 'missing', className: 'h-auto' }))).toBe('');
  });
  it('defers a pending transfer until a visible lease while keeping the original direct-first source', async () => {
    const { XImage } = await import('../apps/X/components/XMedia');
    const src = 'https://pbs.twimg.com/media/GhV2n2da4AAuy9E.jpg';

    const html = renderToStaticMarkup(React.createElement(XImage, { src, alt: 'post' }));

    expect(html).toContain(`data-x-image-source="${src}"`);
    expect(html).not.toMatch(/<img[^>]*\ssrc=/);
    expect(html).not.toContain('/api/gw/proxy');
  });

  it('renders twimg videos and posters directly before trying the proxy fallback', async () => {
    const { XVideo } = await import('../apps/X/components/XMedia');
    const src = 'https://video.twimg.com/ext_tw_video/sample.mp4';
    const poster = 'https://pbs.twimg.com/media/GhV2n2da4AAuy9E.jpg';

    const html = renderToStaticMarkup(React.createElement(XVideo, { src, poster, autoLoad: true }));

    expect(html).toContain(`src="${src}"`);
    expect(html).toContain(`poster="${poster}"`);
    expect(html).not.toContain('/api/gw/proxy');
  });
});
