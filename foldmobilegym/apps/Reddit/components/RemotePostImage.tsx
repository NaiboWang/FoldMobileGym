import React, { useEffect, useRef, useState } from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { isVirtualPostImage } from '../utils/postImage';
import { VirtualPostImage } from './VirtualPostImage';

interface Props {
  src: string;
  className?: string;
  alt?: string;
}

export const RemotePostImage: React.FC<Props> = ({ src, className = '', alt = '' }) => {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const labels = useAppStrings(strings, stringsEn);

  useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [src]);

  useEffect(() => {
    if (!src || failed || isVirtualPostImage(src)) return undefined;
    const image = imageRef.current;
    if (!image) return undefined;
    let timeout: number | undefined;
    const startTimeout = () => {
      if (timeout !== undefined) return;
      timeout = window.setTimeout(() => {
        if (image.naturalWidth === 0) setFailed(true);
      }, 12000);
    };
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) startTimeout();
        }, { rootMargin: '100px' });
    if (observer) observer.observe(image);
    else startTimeout();
    return () => {
      observer?.disconnect();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [src, attempt, failed]);

  if (isVirtualPostImage(src)) return <VirtualPostImage source={src} className={className} alt={alt} />;
  if (failed || !src) {
    return (
      <div className="w-full min-h-[180px] flex flex-col gap-3 items-center justify-center bg-gray-100 text-gray-500 text-sm" data-post-image-unavailable data-retry-attempt={attempt}>
        <span role="img" aria-label={labels.post_image_unavailable}>{labels.post_image_unavailable}</span>
        {src && (
          <button type="button" className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-gray-700 active:bg-gray-200" onClick={() => { setAttempt((value) => value + 1); setFailed(false); }}>
            {labels.post_image_retry}
          </button>
        )}
      </div>
    );
  }

  return <img ref={imageRef} key={attempt} src={src} alt={alt} loading="lazy" draggable={false} className={className} onError={() => setFailed(true)} />;
};
