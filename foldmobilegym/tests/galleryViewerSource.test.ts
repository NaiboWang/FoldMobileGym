import { describe, expect, it } from 'vitest';
import { captureGallerySource, isGallerySourceCurrent } from '../system/Gallery/viewerSource';
import type { FSNode, MediaItem } from '../os/types';

const make = (): FSNode => ({ id:'file-a', path:'/sdcard/Pictures/source.jpg', name:'source.jpg', type:'file', parentId:'pictures', size:4096, mimeType:'image/jpeg', createdAt:100, modifiedAt:100, storage:'indexeddb' });
const media = (node: FSNode): MediaItem => ({ id:node.id, path:node.path, name:node.name, type:'image', uri:'blob:original', size:node.size, mimeType:node.mimeType!, createdAt:node.createdAt });

describe('Gallery selected-file source lease', () => {
  it('captures copied metadata and permits repeated valid Favorite/Undo', () => {
    const node=make(),source=captureGallerySource(media(node),node,0);
    expect(source?.metadata).not.toBe(node);
    expect(isGallerySourceCurrent(source,node,0)).toBe(true);
    expect(isGallerySourceCurrent(source,node,0)).toBe(true);
  });
  it('rejects deleted and recreated nodes even with identical IDs and metadata', () => {
    const node=make(),source=captureGallerySource(media(node),node,3);
    expect(isGallerySourceCurrent(source,null,null)).toBe(false);
    expect(isGallerySourceCurrent(source,{...node},3)).toBe(false);
  });
  it('rejects equal-size/equal-time content replacement and pending writes', () => {
    const node=make(),source=captureGallerySource(media(node),node,3);
    expect(isGallerySourceCurrent(source,node,4)).toBe(false);
    expect(isGallerySourceCurrent(source,node,null)).toBe(false);
  });
  it.each(['id','path','name','size','mimeType','createdAt','modifiedAt','storage','thumbnailUri','width','height','duration'] as const)('does not silently renew in-place changes to %s', key => {
    const node=make(),source=captureGallerySource(media(node),node,3);
    Object.assign(node,{[key]:typeof node[key]==='number'?Number(node[key])+1:'changed'});
    expect(isGallerySourceCurrent(source,node,3)).toBe(false);
  });
  it('does not capture a pending, missing, or different identity', () => {
    const node=make(),item=media(node);
    expect(captureGallerySource(item,node,null)).toBeNull();
    expect(captureGallerySource(item,null,0)).toBeNull();
    expect(captureGallerySource({...item,id:'another'},node,0)).toBeNull();
    expect(captureGallerySource({...item,path:'/other'},node,0)).toBeNull();
  });
  it('only an explicit new capture can accept the current replacement', () => {
    const node=make(),old=captureGallerySource(media(node),node,3);node.createdAt++;
    expect(isGallerySourceCurrent(old,node,4)).toBe(false);
    const next=captureGallerySource(media(node),node,4);
    expect(isGallerySourceCurrent(next,node,4)).toBe(true);
    expect(isGallerySourceCurrent(old,node,4)).toBe(false);
  });
});
