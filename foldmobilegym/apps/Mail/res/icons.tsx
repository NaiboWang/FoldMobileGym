import React from "react";
export { Search as IcMailSearch, ArrowLeft as IcMailBack } from "lucide-react";
export { Paperclip as IcAttachment, X as IcRemoveAttachment } from "lucide-react";
export { Star as IcMailStar } from 'lucide-react';
export { Menu as IcMailMenu, Inbox as IcMailInbox, Folder as IcMailFolder, FileText as IcMailDrafts, Mail as IcMailAll } from 'lucide-react';
export const IcLauncher: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 48 48">
    <rect x="4" y="7" width="40" height="34" rx="7" fill="#fff" />
    <path d="M7 12v26h7V19l10 8 10-8v19h7V12L24 25Z" fill="#ea4335" />
    <path d="M7 12 24 25 41 12" fill="none" stroke="#c5221f" strokeWidth="4" strokeLinejoin="round" />
    <path d="M7 13v25h7V18Z" fill="#4285f4" />
    <path d="M41 13v25h-7V18Z" fill="#34a853" />
    <path d="M7 38h7V25Z" fill="#fbbc04" />
  </svg>
);

export const Icon = IcLauncher;
