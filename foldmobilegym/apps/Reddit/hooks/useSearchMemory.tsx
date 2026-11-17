import React, { createContext, useContext, useRef } from 'react';

const SearchMemory = createContext<Map<string, number> | null>(null);
export function RedditSearchMemory({ children }: { children: React.ReactNode }) {
  const positions = useRef(new Map<string, number>());
  return <SearchMemory.Provider value={positions.current}>{children}</SearchMemory.Provider>;
}
export function useSearchMemory() {
  const positions = useContext(SearchMemory);
  if (!positions) throw new Error('Missing Reddit Activity search memory');
  return positions;
}
