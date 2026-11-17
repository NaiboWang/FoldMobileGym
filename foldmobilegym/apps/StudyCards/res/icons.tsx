import React from "react";
export const IcLauncher: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48">
    <rect x="3" y="3" width="42" height="42" rx="11" fill="#4255ff" />
    <circle
      cx="23"
      cy="22"
      r="11"
      fill="none"
      stroke="white"
      strokeWidth="5"
    />
    <path
      d="m30.5 29.5 7 7"
      stroke="white"
      strokeWidth="5"
      strokeLinecap="round"
    />
  </svg>
);

export const Icon = IcLauncher;
