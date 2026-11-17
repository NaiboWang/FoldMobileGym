import { describe, expect, it } from 'vitest';
import { clampPan, panLimits } from '../system/Gallery/panGeometry';
describe('Gallery image-local pan geometry', () => {
  it('centres images which still fit after zoom', () => {
    expect(panLimits(100,100,400,900,2)).toEqual({x:0,y:0});
  });
  it('allows only the overflowing axis to move', () => {
    expect(panLimits(400,300,400,900,2)).toEqual({x:100,y:0});
  });
  it('clamps pre-scale translations to actual image edges', () => {
    expect(clampPan({x:900,y:-900},panLimits(600,500,400,700,2))).toEqual({x:200,y:-75});
  });
  it('retains valid committed positions', () => {
    expect(clampPan({x:40,y:-20},{x:100,y:80})).toEqual({x:40,y:-20});
  });
  it('centres unzoomed or unavailable/hidden geometry', () => {
    for (const args of [[600,500,400,700,1],[600,500,0,700,2],[NaN,500,400,700,2]]) {
      expect(panLimits(...args as [number,number,number,number,number])).toEqual({x:0,y:0});
    }
  });
});
