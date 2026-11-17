/** Source-owned file thumbnails. Shared Blob URLs are never revoked by this component. */
import React from 'react';
import { IcImage } from '../res/icons';
import { useFileImage } from '../hooks/useFileImage';
export const AsyncImage: React.FC<{
  path: string;
  nodeId?: string;
  className?: string;
  alt?: string;
}> = ({ path, nodeId, className = '', alt = '' }) => {
  const { image, reportImage } = useFileImage(path, nodeId);
  return <div className={`${className} relative overflow-hidden`} data-file-image-state={image.status} data-file-image-node-id={nodeId}>
    {image.uri && <img key={image.key + image.uri} src={image.uri} className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} alt={alt} loading="lazy"
      aria-hidden={image.status !== 'ready' || undefined}
      onLoad={event => reportImage(image.key, image.uri!, event.currentTarget.naturalWidth > 0 && event.currentTarget.naturalHeight > 0)}
      onError={() => reportImage(image.key, image.uri!, false)} />}
    {image.status !== 'ready' && <span className="absolute inset-0 bg-gray-200 flex items-center justify-center pointer-events-none"
      role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={!alt || undefined}>
      <IcImage size={24} className="text-gray-400" />
    </span>}
  </div>;
};
