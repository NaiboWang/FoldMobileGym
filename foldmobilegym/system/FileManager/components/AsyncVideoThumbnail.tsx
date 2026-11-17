/** Display the first decoded frame of the current local file, without playing it. */
import React, { useEffect, useRef, useState } from 'react';
import { IcVideo } from '../res/icons';
import { useFileImage } from '../hooks/useFileImage';

export const AsyncVideoThumbnail: React.FC<{ path: string; nodeId?: string; className?: string; alt?: string }> = ({ path, nodeId, className = '', alt = '' }) => {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    let alive = true;
    const observer = new IntersectionObserver(entries => {
      if (alive) setVisible(entries.some(entry => entry.target === element && entry.isIntersecting));
    });
    observer.observe(element);
    return () => { alive = false; observer.disconnect(); };
  }, []);
  return <div ref={container} className={`${className} relative overflow-hidden`} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
    {visible ? <VisibleVideo path={path} nodeId={nodeId} className={className} /> : <div className="absolute inset-0" data-file-video-node-id={nodeId} data-file-video-state="deferred"><Fallback /></div>}
  </div>;
};

const Fallback = () => <span className="absolute inset-0 bg-gray-200 flex items-center justify-center pointer-events-none" aria-hidden="true">
  <IcVideo size={24} className="text-gray-400" />
</span>;

const VisibleVideo: React.FC<{ path: string; nodeId?: string; className: string }> = ({ path, nodeId, className }) => {
  const { image, reportImage } = useFileImage(path, nodeId);
  return <div className="absolute inset-0" data-file-video-node-id={nodeId} data-file-video-state={image.status}>
    {image.uri && <video key={image.key + image.uri} src={image.uri} className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1}
      onLoadedData={event => reportImage(image.key, image.uri!, event.currentTarget.videoWidth > 0 && event.currentTarget.videoHeight > 0)}
      onError={() => reportImage(image.key, image.uri!, false)} />}
    {image.status !== 'ready' && <Fallback />}
  </div>;
};
