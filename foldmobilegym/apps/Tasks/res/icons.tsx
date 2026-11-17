import React from 'react';
export const IcLauncher: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="todoBlue" x1="8" y1="38" x2="40" y2="10"><stop stopColor="#36c5f0"/><stop offset="1" stopColor="#2564cf"/></linearGradient></defs><path d="m8 26 7 7L40 9l-5-4-20 18-3-3-4 6Z" fill="url(#todoBlue)"/><path d="m17 36 5 5 18-17-5-4-18 16Z" fill="#2564cf" opacity=".82"/></svg>
);
