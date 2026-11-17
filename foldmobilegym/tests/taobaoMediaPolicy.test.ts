import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { leadingTaobaoImagePriority } from '../apps/Taobao/mediaPolicy';
import { TaobaoProductImage } from '../apps/Taobao/components/TaobaoProductImage';
import { strings } from '../apps/Taobao/res/strings';
import { stringsEn } from '../apps/Taobao/res/strings.en';
vi.mock('../apps/Taobao/hooks/useTaobaoStrings', () => ({ useTaobaoStrings: () => ({ media_unavailable: 'Product photo unavailable' }) }));
describe('Taobao source-aware photo presentation and initial hints', () => {
  it.each([0, 1, 2, 3, 4, 5])('gives leading existing-layout cards an initial high hint: %s', index => { expect(leadingTaobaoImagePriority(index)).toBe('high'); });
  it.each([-1, 6, 100, NaN, Infinity])('does not promote every catalog record or malformed position: %s', index => { expect(leadingTaobaoImagePriority(index)).toBe('auto'); });
  it('renders the real source, native lazy loading and initial priority without a placeholder URI', () => {
    const src = '/cdn/taobao/images/original-source.jpg';
    const html = renderToStaticMarkup(React.createElement(TaobaoProductImage, { src, alt: 'Original title', className: 'tb-product-media', priority: 'high' }));
    expect(html).toContain('src="' + src + '"'); expect(html).toContain('data-tb-image-source="' + src + '"');
    expect(html).toContain('loading="lazy"'); expect(html).toMatch(/fetchpriority="high"/i);
    expect(html).toContain('data-tb-image-state="loading"'); expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data:image'); expect(html).not.toContain('Product photo unavailable');
  });
  it('has complete localized unavailable text rather than pretending a replacement SVG is a photo', () => {
    expect(strings.media_unavailable.trim().length).toBeGreaterThan(0);
    expect(stringsEn.media_unavailable).toBe('Product photo unavailable');
    const source = fs.readFileSync(new URL('../apps/Taobao/components/TaobaoProductImage.tsx', import.meta.url), 'utf8');
    expect(source).toContain('key={props.src}'); expect(source).toContain('image === imageRef.current');
    expect(source).toContain('data-tb-image-state="unavailable"'); expect(source).toContain('role="img"');
    expect(source).not.toMatch(/data:image|style[=:]|showImageFallback/);
  });
  it('keeps the prior square/card and cart sizing rules on both success and failure variants', () => {
    const css = fs.readFileSync(new URL('../apps/Taobao/taobao.css', import.meta.url), 'utf8');
    const cart = fs.readFileSync(new URL('../apps/Taobao/taobao-cart.css', import.meta.url), 'utf8');
    const adaptive = fs.readFileSync(new URL('../apps/Taobao/taobao-adaptive.css', import.meta.url), 'utf8');
    expect(css).toContain('.tb-product>.tb-product-media{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#eee}');
    expect(cart).toContain('.tb-cart-item>.tb-cart-thumbnail{width:92px;height:92px;object-fit:cover;border-radius:9px;background:#eee}');
    expect(adaptive).toContain('.tb-cart-item > .tb-cart-thumbnail { width: 72px; height: 72px; }');
    expect(adaptive).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });
});
