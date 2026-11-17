import { describe, expect, it } from 'vitest';
import { readerTapZone } from '../apps/WechatReading/utils/readerTapZone';
import { NAVIGATION_DECLARATION } from '../apps/WechatReading/navigation.declaration';
describe('Reader gestures use the actual app frame', () => {
  it.each([{ left: 599, width: 402 }, { left: 384, width: 831 }, { left: 1200, width: 360 }, { left: 0, width: 320 }])('handles translated and resized frames %j', frame => {
    expect(readerTapZone(frame.left + frame.width * .1, frame)).toBe('previous');
    expect(readerTapZone(frame.left + frame.width * .5, frame)).toBe('menu');
    expect(readerTapZone(frame.left + frame.width * .9, frame)).toBe('next');
  });
  it('is invariant under viewport translation and CSS scaling', () => {
    for (const scale of [.5, 1, 1.75]) for (const left of [0, 500, 1400]) {
      expect(readerTapZone(left + 400 * scale * .8, { left, width: 400 * scale })).toBe('next');
    }
  });
  it.each([0, -1, NaN, Infinity])('does not turn a page for invalid width %s', width => {
    expect(readerTapZone(100, { left: 0, width })).toBe('menu');
  });
  it('declares all actual reader tool states', () => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/read/:bookId');
    for (const tool of ['toc', 'progress', 'theme', 'typography']) {
      expect(route?.uiStates.some(state => 'tool' in state.search && state.search.tool === tool)).toBe(true);
    }
  });
});
