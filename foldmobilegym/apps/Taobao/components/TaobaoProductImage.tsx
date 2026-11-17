import React, { useRef, useState } from 'react';
import { useTaobaoStrings } from '../hooks/useTaobaoStrings';
import { IcCamera } from '../res/icons';
type Props = { src: string; alt: string; className: string; priority?: 'high' | 'auto' };
/** A new source owns its own error/load state; no successful substitute photo. */
export function TaobaoProductImage(props: Props) { return <ProductImageAttempt key={props.src} {...props}/>; }
function ProductImageAttempt({ src, alt, className, priority = 'auto' }: Props) {
  const s = useTaobaoStrings(), imageRef = useRef<HTMLImageElement>(null);
  const [phase, setPhase] = useState<'loading' | 'loaded' | 'unavailable'>('loading');
  if (phase === 'unavailable') return <div className={className + ' tb-image-unavailable'}
    data-tb-image-source={src} data-tb-image-state="unavailable" role="img" aria-label={s.media_unavailable + ': ' + alt}>
    <IcCamera size={24} aria-hidden="true"/><small>{s.media_unavailable}</small>
  </div>;
  return <img ref={imageRef} loading="lazy" fetchPriority={priority} src={src} alt={alt} className={className}
    data-tb-image-source={src} data-tb-image-state={phase} aria-busy={phase === 'loading'}
    onLoad={event => { const image = event.currentTarget;
      if (image === imageRef.current && image.naturalWidth > 0 && (!image.currentSrc || image.currentSrc === image.src)) setPhase('loaded');
    }}
    onError={event => { const image = event.currentTarget;
      if (image === imageRef.current && (!image.currentSrc || image.currentSrc === image.src)) setPhase('unavailable');
    }}/>;
}
