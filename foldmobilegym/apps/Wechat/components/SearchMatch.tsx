import React from 'react';
import { splitSearchMatches } from '../utils/searchMessages';

export const SearchMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => (
  <>{splitSearchMatches(text, query).map((part, index) => part.matched
    ? <mark key={index} className="wechat-search-match">{part.text}</mark>
    : <React.Fragment key={index}>{part.text}</React.Fragment>)}</>
);
