import { SPOTIFY_LEADING_IMAGE_LIMIT } from './constants';

/** Initial request policy by UI position, never by merchant/media ID or test URL. */
export function leadingSpotifyImagePriority(index: number): 'high' | 'auto' {
  return Number.isInteger(index) && index >= 0 && index < SPOTIFY_LEADING_IMAGE_LIMIT ? 'high' : 'auto';
}
