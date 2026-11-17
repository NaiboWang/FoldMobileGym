import { describe, expect, it } from 'vitest';
import { createVideoPlayback } from '../apps/Bilibili/utils/videoPlayback';

describe('preview timeline natural end', () => {
  it('reports natural completion once, not a seek to the end', () => {
    let now = 0; const session = createVideoPlayback(2, () => now);
    session.setActive(true); now = 1999; expect(session.tick()).toBe(false);
    now = 2100; expect(session.tick()).toBe(true); expect(session.tick()).toBe(false);
    session.play(); session.seek(2); expect(session.tick()).toBe(false);
  });
  it('does not report completion while hidden or paused', () => {
    let now = 0; const session = createVideoPlayback(2, () => now);
    now = 5000; expect(session.tick()).toBe(false);
    session.setActive(true); session.pause(); now = 9000; expect(session.tick()).toBe(false);
  });
});
