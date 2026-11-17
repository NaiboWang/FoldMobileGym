import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as MediaService from '../../../os/MediaService';
import ContentResolver from '../../../os/ContentResolver';
import type { Album } from '../../../os/types';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcImage, IcGrid, IcHeart } from '../res/icons';
import { useGalleryGestures } from '../hooks/useGalleryGestures';

export const ReferenceGalleryLayout: React.FC<{
  children: React.ReactNode;
  renderCover: (album: Album) => React.ReactNode;
}> = ({ children, renderCover }) => {
  const location = useLocation();
  const { bindTap, go } = useGalleryGestures();
  const s = useAppStrings(strings, stringsEn);
  const [albums, setAlbums] = useState<Album[]>([]);
  const path = location.pathname;
  const tab = new URLSearchParams(location.search).get('tab') === 'albums' ? 'albums' : 'photos';
  const browsing = path === '/' || path === '/favorites' || path.startsWith('/album/');
  useEffect(() => {
    const update = () => setAlbums(MediaService.getAlbums());
    update();
    return ContentResolver.registerContentObserver('content://media', update);
  }, [path]);

  return <div className={`gallery-reference-layout ${browsing ? 'gallery-reference-browse' : ''}`}>
    <aside inert={new URLSearchParams(location.search).get('selection') === 'on'} className="gallery-reference-directory" data-scroll-container="directory" data-scroll-direction="vertical" aria-label={s.app_name}>
      <h1>{s.reference_gallery_title}</h1>
      <button type="button" aria-current={path === '/' && tab === 'photos' ? 'page' : undefined}
        {...bindTap<HTMLButtonElement>('gallery.directory.photos.open', { onTrigger: () => {
          if (path !== '/' || tab !== 'photos') go('gallery.directory.photos.open');
        } })}><IcImage size={22} /><span>{s.tab_photos}</span></button>
      <button type="button" aria-current={path === '/' && tab === 'albums' ? 'page' : undefined}
        {...bindTap<HTMLButtonElement>('gallery.directory.albums.open', { onTrigger: () => {
          if (path !== '/' || tab !== 'albums') go('gallery.directory.albums.open');
        } })}><IcGrid size={22} /><span>{s.tab_albums}</span></button>
      {albums.map(album => <button type="button" key={album.id}
        aria-current={path === '/album/' + encodeURIComponent(album.id) ? 'page' : undefined}
        {...bindTap<HTMLButtonElement>('album.open', { params: { albumId: album.id }, onTrigger: () => {
          if (path !== '/album/' + encodeURIComponent(album.id)) go('album.open', { albumId: album.id });
        } })}>
        <span className="gallery-directory-cover">{renderCover(album)}</span>
        <span className="gallery-directory-label">{album.name}</span>
        <span className="gallery-directory-count">{album.count}</span>
      </button>)}
      <button type="button" aria-current={path === '/favorites' ? 'page' : undefined}
        {...bindTap<HTMLButtonElement>('favorites.open', { onTrigger: () => {
          if (path !== '/favorites') go('favorites.open');
        } })}><IcHeart size={22} /><span>{s.favorites_title}</span></button>
    </aside>
    <main className="gallery-reference-content">{children}</main>
  </div>;
};
