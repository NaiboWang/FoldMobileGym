import { describe, expect, it } from 'vitest';
import { COMPACT_VIDEO_HEIGHT, rebaseVideoDetailOffset, videoHeaderLayout, recoverVideoBodyOffset } from '../apps/Bilibili/utils/detailHeader';

describe('app-relative Bilibili detail header', () => {
  it('recovers a visible zero-height body without losing an existing body offset', () => {
    expect(recoverVideoBodyOffset(0, 0, 122, true)).toBe(122);
    expect(recoverVideoBodyOffset(281, 0, 122, true)).toBe(281);
  });
  it('does not invent recovery scroll for hidden, healthy or unmeasured bodies', () => {
    expect(recoverVideoBodyOffset(0, 0, 122, false)).toBeNull();
    expect(recoverVideoBodyOffset(281, 70, 122, true)).toBeNull();
    expect(recoverVideoBodyOffset(0, 0, 0, true)).toBeNull();
    expect(recoverVideoBodyOffset(0, NaN, 122, true)).toBeNull();
  });
  it('starts at original geometry and follows an early continuous scroll', () => {
    const initial=videoHeaderLayout(832,0),partial=videoHeaderLayout(832,80);
    expect(initial).toEqual({maxCollapse:424,collapse:0,compact:false});
    expect(partial).toEqual({maxCollapse:424,collapse:80,compact:false});
  });
  it('bounds the compact surface without changing the video timeline', () => {
    const result=videoHeaderLayout(832,99999);
    expect(result).toEqual({maxCollapse:424,collapse:424,compact:true});
    expect(832*9/16-result.collapse).toBe(COMPACT_VIDEO_HEIGHT);
  });
  it('compensating padding preserves one-to-one movement and constant scroll range', () => {
    const natural=832*9/16,initialViewport=300,content=2000;
    for(const offset of [0,20,80,424,600,1200]) {
      const {collapse}=videoHeaderLayout(832,offset);
      expect(natural-collapse+collapse-offset).toBe(natural-offset);
      expect(content+collapse-(initialViewport+collapse)).toBe(content-initialViewport);
    }
  });
  it('handles invalid, backwards and tiny-window input safely', () => {
    expect(videoHeaderLayout(NaN,Infinity)).toEqual({maxCollapse:0,collapse:0,compact:false});
    expect(videoHeaderLayout(832,-200).collapse).toBe(0);
    expect(videoHeaderLayout(30,999).collapse).toBe(0);
  });
  it('retains body progress through expanded/cover changes rather than the old header budget', () => {
    const old=videoHeaderLayout(832,0).maxCollapse,next=videoHeaderLayout(412,0).maxCollapse;
    const rebased=rebaseVideoDetailOffset(old+177,old,next);
    expect(rebased-next).toBe(177);
    expect(rebaseVideoDetailOffset(rebased,next,old)).toBe(old+177);
  });
  it('retains a partially collapsed fraction on resize', () => {
    expect(rebaseVideoDetailOffset(100,400,200)).toBe(50);
    expect(rebaseVideoDetailOffset(50,200,400)).toBe(100);
  });
  it('never invents scroll for an unmeasured/new entry', () => {
    expect(rebaseVideoDetailOffset(0,0,424)).toBe(0);
    expect(rebaseVideoDetailOffset(30,0,424)).toBe(30);
    expect(rebaseVideoDetailOffset(-1,400,200)).toBe(0);
  });
  it('bounds invalid extent and offset values', () => {
    expect(rebaseVideoDetailOffset(NaN,400,200)).toBe(0);
    expect(rebaseVideoDetailOffset(100,Infinity,200)).toBe(100);
    expect(rebaseVideoDetailOffset(500,400,NaN)).toBe(100);
  });
});
