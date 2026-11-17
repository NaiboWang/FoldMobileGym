import { describe, expect, it } from 'vitest';
import { buildNodeId } from '../scripts/navigation_node_id.mjs';
describe('dynamic query graph node identity', () => {
  it('uses one placeholder for dynamic values, not duplicate literal and placeholder keys', () => {
    expect(buildNodeId('/photo/:path',{from:'search'},{album:'string',from:'string',q:'string'}))
      .toBe('/photo/:path?album=:album&from=:from&q=:q');
  });
  it('still distinguishes genuine modal state while canonicalising dynamic source context', () => {
    expect(buildNodeId('/photo/:path',{modal:'more',from:'search'},{from:'string',q:'string'}))
      .toBe('/photo/:path?modal=more&from=:from&q=:q');
  });
  it('does not enumerate user input as discrete graph nodes', () => {
    expect(buildNodeId('/search',{q:'lake'},{q:'string'})).toBe(buildNodeId('/search',{}, {q:'string'}));
  });
  it('retains discrete state keys and existing empty-query node identity', () => {
    expect(buildNodeId('/',{tab:'albums'},{})).toBe('/?tab=albums');
    expect(buildNodeId('/',{},{})).toBe('/');
  });
});
