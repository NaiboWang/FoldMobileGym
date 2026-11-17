import { describe, expect, it } from 'vitest';
import { planGalleryImageFailure } from '../system/Gallery/imageFailure';

const primary = { path: '/photo/a.jpg', source: 'blob:primary' };
describe('Gallery image decode recovery', () => {
  it('tries the supplied thumbnail when the file source fails', () => {
    expect(planGalleryImageFailure(primary, primary, 'data:image/png;base64,thumbnail'))
      .toEqual({ kind: 'fallback', source: 'data:image/png;base64,thumbnail' });
  });
  it.each([undefined, '', '   '])('uses the error placeholder when no alternate exists: %s', fallback => {
    expect(planGalleryImageFailure(primary, primary, fallback)).toEqual({ kind: 'error' });
  });
  it('does not retry the failed source as its own fallback', () => {
    expect(planGalleryImageFailure(primary, primary, primary.source)).toEqual({ kind: 'error' });
  });
  it('terminates if the alternate also fails instead of looping', () => {
    const alternate = { ...primary, source: 'data:image/png;base64,broken' };
    expect(planGalleryImageFailure(alternate, alternate, alternate.source)).toEqual({ kind: 'error' });
  });
  it('ignores a failure from a previous photo', () => {
    expect(planGalleryImageFailure(primary, { path: '/photo/b.jpg', source: primary.source }, 'thumbnail'))
      .toEqual({ kind: 'ignore' });
  });
  it('ignores the original failure after switching to the thumbnail', () => {
    expect(planGalleryImageFailure(primary, { ...primary, source: 'thumbnail' }, 'thumbnail'))
      .toEqual({ kind: 'ignore' });
  });
  it('ignores an obsolete source after a pending reset', () => {
    expect(planGalleryImageFailure(primary, { ...primary, source: null }, 'thumbnail')).toEqual({ kind: 'ignore' });
  });
  it('allows a new photo to attempt its own alternate', () => {
    const next = { path: '/photo/b.jpg', source: 'blob:next' };
    expect(planGalleryImageFailure(next, next, 'next-thumbnail')).toEqual({ kind: 'fallback', source: 'next-thumbnail' });
  });
  it('does not mutate caller-owned attempt identities', () => {
    const frozen = Object.freeze({ ...primary });
    expect(planGalleryImageFailure(frozen, frozen, 'thumbnail')).toEqual({ kind: 'fallback', source: 'thumbnail' });
    expect(frozen).toEqual(primary);
  });
});
