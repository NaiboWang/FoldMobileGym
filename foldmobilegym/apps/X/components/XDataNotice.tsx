import React from 'react';
import { useXStrings } from '../hooks/useXStrings';
export const XDataNotice: React.FC<{ loading: boolean; failed: boolean; retryProps: React.ButtonHTMLAttributes<HTMLButtonElement> }> = ({ loading, failed, retryProps }) => {
  const s = useXStrings();
  if (!loading && !failed) return null;
  return <div data-x-data-state={loading ? 'loading' : 'error'} role="status" className="p-5 text-sm text-gray-500 text-center">
    <p>{loading ? s.post_loading_data : s.post_data_failed}</p>
    {!loading && failed && <button type="button" {...retryProps} className="mt-3 px-4 py-2 rounded-full border border-app-border text-app-text">{s.post_data_retry}</button>}
  </div>;
};
