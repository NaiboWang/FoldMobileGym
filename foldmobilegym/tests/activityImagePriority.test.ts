import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prioritizeVisibleActivityImages } from '../os/activityImagePriority';
class Image {
  nodeType = 1; tagName = 'IMG'; visible = true;
  attrs = new Map<string, string>([['src', '/cdn/spotify/images/source.jpg']]);
  getAttribute = (key: string) => this.attrs.get(key) ?? null;
  setAttribute = (key: string, value: string) => { this.attrs.set(key, value); };
  removeAttribute = (key: string) => { this.attrs.delete(key); };
  querySelectorAll = () => [];
  checkVisibility = () => this.visible;
}
class Root {
  nodeType = 1; tagName = 'DIV'; images = new Set<Image>();
  contains = (node: Image) => this.images.has(node);
  querySelectorAll = () => [...this.images];
}
class Intersections {
  static all: Intersections[] = [];
  observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  constructor(public callback: (entries: any[]) => void) { Intersections.all.push(this); }
  emit(image: Image, visible = true, width = 20, height = 20) { this.callback([{ target: image, isIntersecting: visible, intersectionRect: { width, height } }]); }
}
class Mutations {
  static all: Mutations[] = [];
  observe = vi.fn(); disconnect = vi.fn();
  constructor(public callback: (entries: any[]) => void) { Mutations.all.push(this); }
  emit(record: any) { this.callback([record]); }
}
const cleanups: (() => void)[] = [];
function mount(root: Root) { const close = prioritizeVisibleActivityImages(root as unknown as HTMLElement); cleanups.push(close); return close; }
function rootWith(...images: Image[]) { const root = new Root(); images.forEach(image => root.images.add(image)); return root; }
beforeEach(() => { Intersections.all = []; Mutations.all = []; vi.stubGlobal('IntersectionObserver', Intersections); vi.stubGlobal('MutationObserver', Mutations); });
afterEach(() => { cleanups.splice(0).forEach(close => close()); vi.unstubAllGlobals(); });
describe('Activity-scoped native image priority, no replacement or benchmark bypass', () => {
  it('promotes only actual intersections and leaves source/style/visibility unchanged', () => {
    const image = new Image(), root = rootWith(image), source = image.getAttribute('src'); mount(root);
    Intersections.all[0].emit(image);
    expect(image.getAttribute('fetchpriority')).toBe('high');
    expect(image.getAttribute('src')).toBe(source); expect(image.getAttribute('style')).toBeNull();
    Intersections.all[0].emit(image, false); expect(image.getAttribute('fetchpriority')).toBe('auto');
  });
  it('does not promote zero-area or currently hidden images from stale intersection samples', () => {
    const image = new Image(); mount(rootWith(image));
    Intersections.all[0].emit(image, true, 0, 20); expect(image.getAttribute('fetchpriority')).toBe('auto');
    image.visible = false; Intersections.all[0].emit(image); expect(image.getAttribute('fetchpriority')).toBe('auto');
  });
  it('observes newly inserted images and restores removed images without stale writes', () => {
    const root = rootWith(), image = new Image(); mount(root); root.images.add(image);
    Mutations.all[0].emit({ type: 'childList', addedNodes: [image], removedNodes: [] });
    expect(Intersections.all[0].observe).toHaveBeenCalledWith(image);
    Intersections.all[0].emit(image); root.images.delete(image);
    Mutations.all[0].emit({ type: 'childList', addedNodes: [], removedNodes: [image] });
    expect(image.getAttribute('fetchpriority')).toBeNull(); Intersections.all[0].emit(image); expect(image.getAttribute('fetchpriority')).toBeNull();
  });
  it('cleans both observers, restores original attributes and ignores queued callbacks', () => {
    const one = new Image(), two = new Image(); two.setAttribute('fetchpriority', 'AUTO'); const close = mount(rootWith(one, two));
    Intersections.all[0].emit(one); Intersections.all[0].emit(two); close(); close();
    expect(one.getAttribute('fetchpriority')).toBeNull(); expect(two.getAttribute('fetchpriority')).toBe('AUTO');
    expect(Intersections.all[0].disconnect).toHaveBeenCalledTimes(1); expect(Mutations.all[0].disconnect).toHaveBeenCalledTimes(1);
    Intersections.all[0].emit(one); expect(one.getAttribute('fetchpriority')).toBeNull();
  });
  it('respects explicit app high/low priorities rather than stealing ownership', () => {
    const one = new Image(), two = new Image(); one.setAttribute('fetchpriority', 'high'); two.setAttribute('fetchpriority', 'low'); mount(rootWith(one, two));
    expect(Intersections.all[0].observe).not.toHaveBeenCalled();
    Intersections.all[0].emit(two); expect(two.getAttribute('fetchpriority')).toBe('low');
  });
  it('does not overwrite a later app-owned priority change', () => {
    const image = new Image(); const close = mount(rootWith(image)); Intersections.all[0].emit(image);
    image.setAttribute('fetchpriority', 'low'); Mutations.all[0].emit({ type: 'attributes', target: image });
    Intersections.all[0].emit(image); close(); expect(image.getAttribute('fetchpriority')).toBe('low');
  });
  it('does not let a removed Activity clobber a new owner of the same image node', () => {
    const image = new Image(), one = rootWith(image), closeOne = mount(one); Intersections.all[0].emit(image);
    one.images.delete(image); const two = rootWith(image), closeTwo = mount(two); closeOne();
    expect(image.getAttribute('fetchpriority')).toBe('high');
    Intersections.all[1].emit(image, false); expect(image.getAttribute('fetchpriority')).toBe('auto');
    closeTwo(); expect(image.getAttribute('fetchpriority')).toBeNull();
  });
  it('keeps new source URLs intact when a mounted image source changes', () => {
    const image = new Image(); mount(rootWith(image)); Intersections.all[0].emit(image);
    image.setAttribute('src', '/cdn/spotify/images/new-source.jpg'); Mutations.all[0].emit({ type: 'attributes', target: image });
    Intersections.all[0].emit(image); expect(image.getAttribute('src')).toBe('/cdn/spotify/images/new-source.jpg');
  });
  it('degrades without hiding content when native observation is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined); const image = new Image(); mount(rootWith(image));
    expect([...image.attrs]).toEqual([['src', '/cdn/spotify/images/source.jpg']]);
  });
});
