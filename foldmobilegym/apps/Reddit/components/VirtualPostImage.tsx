import React, { useEffect, useState } from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { resolveVirtualPostImage } from '../utils/postImage';

export function VirtualPostImage({ source, className = '', alt = '' }: { source: string; className?: string; alt?: string }) {
  const labels = useAppStrings(strings, stringsEn);
  const [loaded, setLoaded] = useState<{ source: string; uri: string | null; failed: boolean } | null>(null);
  useEffect(() => {
    let current = true, ownedUri: string | null = null;
    setLoaded(null);
    void resolveVirtualPostImage(source).then(uri => {
      if (current) { ownedUri = uri; setLoaded({ source, uri, failed: !uri }); }
      else if (uri) URL.revokeObjectURL(uri);
    })
      .catch(() => { if (current) setLoaded({ source, uri: null, failed: true }); });
    return () => { current = false; if (ownedUri) URL.revokeObjectURL(ownedUri); };
  }, [source]);
  if (!loaded || loaded.source !== source) return <span className={className} aria-busy="true" />;
  if (loaded.failed || !loaded.uri) return <span className={className} data-post-image-unavailable role="img" aria-label={labels.post_image_unavailable}>{labels.post_image_unavailable}</span>;
  return <img src={loaded.uri} data-virtual-post-image={source} alt={alt} loading="lazy" draggable={false} className={className}
    onError={() => setLoaded(value => value?.source === source ? { source, uri: null, failed: true } : value)} />;
}
