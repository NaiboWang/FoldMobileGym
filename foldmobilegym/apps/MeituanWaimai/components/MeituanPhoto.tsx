import React, { useState } from 'react';

/** Mount with key=src so an old image failure cannot poison a replacement source. */
export function MeituanPhoto({ src, label, fallback }: {
  src?: string; label: string; fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="mt-photo-unavailable" data-meituan-media-unavailable role="img" aria-label={label}>{fallback}</div>;
  return <img src={src} alt={label} onError={() => setFailed(true)}/>;
}
