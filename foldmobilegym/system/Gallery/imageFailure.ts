type ImageAttempt = { path: string; source: string | null };
type ImageFailurePlan = { kind: 'ignore' | 'error' } | { kind: 'fallback'; source: string };

/** Use only this file's supplied alternate image; ignore obsolete load events. */
export function planGalleryImageFailure(attempt: ImageAttempt, active: ImageAttempt, fallback?: string): ImageFailurePlan {
  if (attempt.path !== active.path || attempt.source !== active.source) return { kind: 'ignore' };
  if (fallback?.trim() && fallback !== attempt.source) return { kind: 'fallback', source: fallback };
  return { kind: 'error' };
}
