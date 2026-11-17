import React from 'react';
import { useXStrings } from '../hooks/useXStrings';
import { makeImageAttemptPool, useXImageAttempts } from './XImageAttemptProvider';
import type { ImageAttemptLease } from '../utils/imageAttemptPool';
import { readOwnedXImageSize, xIntrinsicAspectRatio } from '../utils/intrinsicImageFootprint';
import { permittedXImageSource, ownsXImageBinding } from '../utils/imageRequestGate';

type XImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  active?: boolean;
};

const getProxiedUrl = (url?: string | null) => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) {
    return `/api/gw/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export function XImage(props: XImageProps) {
  // A new source owns new loading/error state and timeout attempts. Backgrounding
  // or changing the alt/class of the same source must keep the current attempt.
  return <XImageAttempt key={props.src ?? ''} {...props} />;
}

function XImageAttempt({ src, alt, className, active = true }: XImageProps) {
  const owner = useXImageAttempts();
  const [ownPool] = React.useState(makeImageAttemptPool), pool = owner?.pool ?? ownPool;
  const attempt = React.useMemo(() => pool.get(src ?? ''), [pool, src]);
  const { phase, intrinsicSize } = React.useSyncExternalStore(attempt.subscribe, attempt.getSnapshot, attempt.getSnapshot);
  const [loadedSrc, setLoadedSrc] = React.useState<string>();
  const [permittedSrc, setPermittedSrc] = React.useState<string>();
  const imageRef = React.useRef<HTMLImageElement>(null), leaseRef = React.useRef<ImageAttemptLease | null>(null);
  const s = useXStrings();
  const isActive = active && (owner?.active ?? true);
  // A healthy DOM image stays on its successful bytes even if a duplicate consumer fails.
  const displaySrc = loadedSrc ?? (phase === 'proxy' ? getProxiedUrl(src) : src);
  const requestSrc = permittedXImageSource(displaySrc, permittedSrc, loadedSrc);
  const referrerPolicy = src?.includes('twimg.com') && !displaySrc?.startsWith('/api/gw/proxy?') ? 'no-referrer' : undefined;
  const loaded = !!loadedSrc, hasError = !loaded && phase === 'failed';
  const autoHeightMedia = !!className?.split(/\s+/).includes('h-auto');
  const pendingMedia = !loaded && autoHeightMedia;
  const aspectRatio = autoHeightMedia ? xIntrinsicAspectRatio(intrinsicSize) : undefined;
  const captureIntrinsic = React.useCallback((image: HTMLImageElement) => {
    if (!autoHeightMedia || image !== imageRef.current || !src) return;
    const size = readOwnedXImageSize(image, [src, getProxiedUrl(src)], window.location.href);
    if (size) attempt.rememberIntrinsic(size);
  }, [attempt, autoHeightMedia, src]);
  React.useEffect(() => {
    const image = imageRef.current;
    if (!image || !autoHeightMedia || hasError) return;
    let live = true;
    const remember = () => { if (live) captureIntrinsic(image); };
    remember();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remember);
    observer?.observe(image);
    return () => { live = false; observer?.disconnect(); };
  }, [autoHeightMedia, captureIntrinsic, hasError]);

  React.useEffect(() => {
    const lease = attempt.connect(); leaseRef.current = lease;
    return () => { lease.release(); if (leaseRef.current === lease) leaseRef.current = null; };
  }, [attempt]);
  React.useEffect(() => {
    const image = imageRef.current, lease = leaseRef.current;
    if (!image || !lease || !src || hasError || loaded || !isActive) { lease?.setVisible(false); return; }
    let live = true;
    const authorize = (visible: boolean) => {
      if (!live || image !== imageRef.current || attempt.getSnapshot().phase !== phase) return;
      lease.setVisible(visible);
      if (visible) setPermittedSrc(displaySrc ?? undefined);
    };
    if (image.getAttribute('src') === displaySrc
        && image.complete && image.naturalWidth > 0 && image.currentSrc === image.src) {
      lease.loaded(); setLoadedSrc(displaySrc ?? undefined); return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      authorize(true); return () => { live = false; lease.setVisible(false); };
    }
    const observer = new IntersectionObserver(([entry]) => {
      authorize(entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0);
    }, { rootMargin: '50px' });
    observer.observe(image);
    return () => { live = false; observer.disconnect(); lease.setVisible(false); };
    // Permission follows this observer, not a render-driven fresh loading budget.
  }, [attempt, src, displaySrc, phase, hasError, loaded, isActive]);

  if (!src) return null;
  if (hasError) {
    const compact = className?.includes('h-full');
    return <div className={`${compact ? className : autoHeightMedia ? `${className} min-h-[120px] p-4` : 'w-full min-h-[120px] p-4'} flex items-center justify-center bg-app-surface text-gray-400 text-sm`}
      style={aspectRatio ? { aspectRatio } : undefined} role="img" aria-label={alt}>
      {compact ? (alt.trim()[0] || '?') : s.media_image_load_failed}
    </div>;
  }
  return <img ref={imageRef} data-x-image-source={src} src={requestSrc} alt={alt} className={className} aria-busy={!loaded}
    style={pendingMedia ? { minHeight: 120, ...(aspectRatio ? { aspectRatio } : {}) } : undefined} {...({ referrerPolicy } as any)} loading="lazy"
    onLoad={event => {
      if (event.currentTarget !== imageRef.current || !event.currentTarget.naturalWidth || attempt.getSnapshot().phase !== phase
          || !ownsXImageBinding(event.currentTarget.getAttribute('src'), displaySrc, permittedSrc)) return;
      if (event.currentTarget.currentSrc && event.currentTarget.currentSrc !== event.currentTarget.src) return;
      captureIntrinsic(event.currentTarget);
      leaseRef.current?.loaded(); setLoadedSrc(displaySrc ?? undefined);
    }}
    onError={event => {
      const image = event.currentTarget;
      if (image !== imageRef.current || !ownsXImageBinding(image.getAttribute('src'), displaySrc, permittedSrc) || (image.currentSrc && image.currentSrc !== image.src)) return;
      captureIntrinsic(image);
      attempt.fail(phase);
    }} />;
}

type XVideoProps = {
  src?: string | null;
  poster?: string | null;
  className?: string;
  active?: boolean;
  autoLoad?: boolean;
};

export function XVideo({ src, poster, className, active = true, autoLoad = false }: XVideoProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(autoLoad);
  const [useProxy, setUseProxy] = React.useState(false);
  const [isInteracting, setIsInteracting] = React.useState(false);
  const s = useXStrings();

  const displaySrc = useProxy ? getProxiedUrl(src) : src;
  const displayPoster = useProxy ? getProxiedUrl(poster) : poster;
  const referrerPolicy = src?.includes('twimg.com') && !useProxy ? 'no-referrer' : undefined;
  const containerClassName = ['relative w-full overflow-hidden bg-app-bg', className].filter(Boolean).join(' ');

  React.useEffect(() => {
    setHasError(false);
    setLoaded(autoLoad);
    setUseProxy(false);
    setIsInteracting(false);
  }, [src, poster, autoLoad]);

  React.useEffect(() => {
    if (active) return;
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [active]);

  React.useEffect(() => {
    if (!active || !containerRef.current) return;
    const container = containerRef.current;
    const video = videoRef.current;
    let loadTimer: number | undefined;
    const clearLoadTimer = () => {
      if (loadTimer !== undefined) window.clearTimeout(loadTimer);
      loadTimer = undefined;
    };

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        if (!loaded && loadTimer === undefined) {
          loadTimer = window.setTimeout(() => {
            loadTimer = undefined;
            setLoaded(true);
          }, 500);
        }

        if (loaded && video?.paused) {
          video.play().catch(() => {});
        }
      } else {
        clearLoadTimer();
        if (video && !video.paused) {
          video.pause();
        }
      }
    }, { threshold: 0.5 });

    observer.observe(container);
    return () => {
      observer.disconnect();
      clearLoadTimer();
      if (video && !video.paused) {
        video.pause();
      }
    };
  }, [active, loaded]);

  React.useEffect(() => {
    if (active && loaded && videoRef.current && !isInteracting) {
      videoRef.current.play().catch(() => {});
    }
  }, [active, isInteracting, loaded]);

  if (!src) return null;

  if (hasError) {
    return (
      <div className={`${containerClassName} flex flex-col items-center justify-center min-h-[200px]`}>
        {poster && <XImage src={displayPoster || poster} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm" alt="" />}
        <div className="relative z-10 flex flex-col items-center gap-3 p-4 bg-black/60 rounded-xl backdrop-blur-sm">
          <div className="text-gray-200 text-sm font-medium">{s.media_video_load_failed}</div>
          <a className="px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors" href={src} target="_blank" rel="noreferrer">
            {s.media_video_open_new_window}
          </a>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div ref={containerRef} className={`${containerClassName} flex flex-col items-center justify-center min-h-[200px] cursor-pointer group`} onClick={() => setLoaded(true)}>
        {poster ? (
          <XImage src={displayPoster || poster} className="absolute inset-0 w-full h-full object-cover" alt="" />
        ) : (
          <div className="absolute inset-0 bg-gray-100 animate-pulse" />
        )}

        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        <button className="relative z-10 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110" aria-label="Play video">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-1">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={containerClassName}>
      <video
        ref={videoRef}
        src={displaySrc || undefined}
        poster={displayPoster || poster || undefined}
        controls={isInteracting}
        muted={!isInteracting}
        loop
        playsInline
        preload="metadata"
        className={`w-full h-full ${isInteracting ? 'object-contain' : 'object-cover'} max-h-(--app-feed-image-max-height)`}
        {...({ referrerPolicy } as any)}
        onError={(event) => {
          const media = event.currentTarget;
          const code = media?.error?.code;
          if (code === 1) return;
          if (src && /^https?:\/\//i.test(src) && !useProxy) {
            setUseProxy(true);
          } else {
            setHasError(true);
          }
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (!isInteracting) {
            setIsInteracting(true);
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              void videoRef.current.play();
            }
          }
        }}
      />

      {!isInteracting && (
        <div
          className="absolute bottom-3 right-3 bg-black/60 rounded-full p-2 cursor-pointer hover:bg-black/80 transition-colors"
          onClick={(event) => {
            event.stopPropagation();
            setIsInteracting(true);
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
              void videoRef.current.play();
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        </div>
      )}
    </div>
  );
}
